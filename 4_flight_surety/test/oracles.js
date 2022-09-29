var Test = require("../config/testConfig.js")
const {
  createAirlines,
  voteForAirlines,
  registerOracles,
  submitOracleResponses,
} = require("./utils.js")
const truffleAssert = require("truffle-assertions")

contract("Oracles", async (accounts) => {
  const TEST_ORACLES_COUNT = 20
  const MIN_RESPONSES = 3

  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0
  const STATUS_CODE_ON_TIME = 10
  const STATUS_CODE_LATE_AIRLINE = 20
  const STATUS_CODE_LATE_WEATHER = 30
  const STATUS_CODE_LATE_TECHNICAL = 40
  const STATUS_CODE_LATE_OTHER = 50

  const activationFee = web3.utils.toWei("10", "ether")

  let config
  let airlines = []

  beforeEach("setup contract", async () => {
    config = await Test.Config(accounts)

    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    )
    await config.flightSuretyData.authorizeCaller(config.owner)

    airlines = [
      { name: "Airline 1", address: config.firstAirline },
      { name: "Airline 2", address: config.secondAirline },
      { name: "Airline 3", address: config.thirdAirline },
      { name: "Airline 4", address: config.fourthAirline },
      { name: "Airline 5", address: config.fifthAirline },
    ]
  })

  it("can register oracles", async () => {
    // ARRANGE
    const registration_fee =
      await config.flightSuretyApp.REGISTRATION_FEE.call()

    // ACT
    for (let i = 1; i < TEST_ORACLES_COUNT; i++) {
      await config.flightSuretyApp.registerOracle({
        from: accounts[i],
        value: registration_fee,
      })

      const result = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[i],
      })

      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`)
    }
  })

  it("can request flight status", async () => {
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    )
    await config.flightSuretyData.authorizeCaller(config.owner)

    await createAirlines(config, airlines)

    await voteForAirlines(config, airlines)

    await config.flightSuretyData.provideAirlinefunding(airlines[0].address, {
      from: airlines[0].address,
      value: activationFee,
    })

    const flightName = "Flight 001"
    const insurancePrice = web3.utils.toWei("0.01", "ether")
    await config.flightSuretyApp.registerFlightForInsurance(
      airlines[0].address,
      flightName,
      insurancePrice,
      { from: airlines[0].address }
    )

    await registerOracles(config, accounts, TEST_ORACLES_COUNT)

    const event = await config.flightSuretyApp.requestFlightStatus(
      airlines[0].address,
      flightName,
      { from: airlines[0].address }
    )

    const [requestIndex, timestamp] = await new Promise((resolve, reject) => {
      truffleAssert.eventEmitted(event, "OracleRequest", (ev) => {
        resolve([ev.index.toNumber(), ev.timestamp.toNumber()])
      })
    })
    console.log({ requestIndex, timestamp })

    const submitEvents = await submitOracleResponses(
      config,
      accounts,
      airlines,
      TEST_ORACLES_COUNT,
      requestIndex,
      flightName,
      timestamp,
      STATUS_CODE_ON_TIME
    )

    const hasEnoughResponses =
      submitEvents.filter((event) => !!event).length >= MIN_RESPONSES
    submitEvents.forEach(async (event) => {
      if (!event) return

      truffleAssert.eventEmitted(event, "OracleReport", (ev) => {
        return (
          ev.airline === airlines[0].address &&
          ev.status.toNumber() === STATUS_CODE_ON_TIME
        )
      })
    })

    if (hasEnoughResponses) {
      let flightStatusWasEmitted = false

      submitEvents.forEach((event) => {
        if (!event) return

        event.logs.forEach((log) => {
          if (
            log.event === "FlightStatusInfo" &&
            log.args.airline === airlines[0].address &&
            log.args.status.toNumber() === STATUS_CODE_ON_TIME
          ) {
            flightStatusWasEmitted = true
          }
        })
      })

      assert.ok(flightStatusWasEmitted, "FlightStatusInfo was not emitted")

      await config.flightSuretyData.payoutInsurees(airlineAddress, flightName, {
        from: config.owner,
      })
    }
  })

  it.only("oracle consensus triggers crediting of insurees", async () => {
    const airlineAddress = airlines[0].address

    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    )
    await config.flightSuretyData.authorizeCaller(config.owner)

    await createAirlines(config, airlines)

    await voteForAirlines(config, airlines)

    await config.flightSuretyData.provideAirlinefunding(airlineAddress, {
      from: airlineAddress,
      value: activationFee,
    })

    const flightName = "Flight 001"
    const insurancePrice = web3.utils.toWei("0.01", "ether")
    await config.flightSuretyApp.registerFlightForInsurance(
      airlineAddress,
      flightName,
      insurancePrice,
      { from: airlineAddress }
    )

    await config.flightSuretyData.buyInsuranceForFlight(
      airlineAddress,
      flightName,
      { from: accounts[5], value: insurancePrice }
    )
    await config.flightSuretyData.buyInsuranceForFlight(
      airlineAddress,
      flightName,
      { from: accounts[6], value: insurancePrice }
    )

    await config.flightSuretyData.freezeFlight(airlineAddress, flightName, {
      from: airlineAddress,
    })

    await registerOracles(config, accounts, TEST_ORACLES_COUNT)

    const event = await config.flightSuretyApp.requestFlightStatus(
      airlineAddress,
      flightName,
      { from: airlineAddress }
    )

    const [requestIndex, timestamp] = await new Promise((resolve, reject) => {
      truffleAssert.eventEmitted(event, "OracleRequest", (ev) => {
        resolve([ev.index.toNumber(), ev.timestamp.toNumber()])
      })
    })
    console.log({ requestIndex, timestamp })

    const airlineBefore = await config.flightSuretyData.getAirline(
      airlineAddress
    )

    const submitEvents = await submitOracleResponses(
      config,
      accounts,
      airlines,
      TEST_ORACLES_COUNT,
      requestIndex,
      flightName,
      timestamp,
      STATUS_CODE_LATE_AIRLINE
    )

    const hasEnoughResponses =
      submitEvents.filter((event) => !!event).length >= MIN_RESPONSES

    submitEvents.forEach(async (event) => {
      if (!event) return

      truffleAssert.eventEmitted(event, "OracleReport", (ev) => {
        return (
          ev.airline === airlineAddress &&
          ev.status.toNumber() === STATUS_CODE_LATE_AIRLINE
        )
      })
    })

    if (hasEnoughResponses) {
      let insureesWereCredited = false

      const airline = await config.flightSuretyData.getAirline(airlineAddress)

      const flightKey = await config.flightSuretyData.getFlightKey(
        airlineAddress,
        flightName
      )
      const flight = await config.flightSuretyData.getFlight(flightKey)

      assert(
        parseInt(airline[5]) ===
          parseInt(airlineBefore[5] - 3 * insurancePrice),
        "Insurance balance is not updated correctly"
      )
      assert(
        parseInt(flight[1]) === STATUS_CODE_LATE_AIRLINE,
        "Status code was not updated correctly"
      )

      // assert.ok(insureesWereCredited, "CreditInsuree was not emitted")

      // const registeredPayouts =
      //   await config.flightSuretyData.getRegisteredPayouts(
      //     airlineAddress,
      //     flightName
      //   )

      // assert.equal(
      //   registeredPayouts[0],
      //   2,
      //   "Insuree length not credited correctly"
      // )
      // assert.equal(
      //   registeredPayouts[1],
      //   3 * insurancePrice,
      //   "Insurance amount not credited correctly"
      // )
      // assert.ok(
      //   registeredPayouts[2].includes(accounts[5]),
      //   "Insuree is not registered for payout"
      // )
      // assert.ok(
      //   registeredPayouts[2].includes(accounts[6]),
      //   "Insuree is not registered for payout"
      // )

      // await truffleAssert.reverts(
      //   config.flightSuretyData.creditInsurees(airlineAddress, flightName, {
      //     from: config.owner,
      //   }),
      //   "Flight is already credited, payouts are ready"
      // )
    }
  })

  it("can retrieve the correct flight status", async () => {
    await createAirlines(config, airlines)

    await voteForAirlines(config, airlines)

    await config.flightSuretyData.provideAirlinefunding(airlines[0].address, {
      from: airlines[0].address,
      value: activationFee,
    })

    const flight = "Flight 001"
    const insurancePrice = web3.utils.toWei("0.01", "ether")
    await config.flightSuretyApp.registerFlightForInsurance(
      airlines[0].address,
      flight,
      insurancePrice,
      { from: airlines[0].address }
    )

    await registerOracles(config, accounts, TEST_ORACLES_COUNT)

    const event = await config.flightSuretyApp.requestFlightStatus(
      airlines[0].address,
      flight,
      { from: airlines[0].address }
    )

    const [requestIndex, timestamp] = await new Promise((resolve, reject) => {
      truffleAssert.eventEmitted(event, "OracleRequest", (ev) => {
        resolve([ev.index.toNumber(), ev.timestamp.toNumber()])
      })
    })
    console.log({ requestIndex, timestamp })

    const submitEvents = await submitOracleResponses(
      config,
      accounts,
      airlines,
      TEST_ORACLES_COUNT,
      requestIndex,
      flight,
      timestamp,
      STATUS_CODE_ON_TIME
    )
    const hasEnoughResponses =
      submitEvents.filter((event) => !!event).length >= MIN_RESPONSES

    if (!hasEnoughResponses) {
      throw Error(
        `Not enough responses to run test, having ${
          submitEvents.filter((event) => !!event).length
        } need ${MIN_RESPONSES}`
      )
    }
    console.log({ hasEnoughResponses })

    const flightKey = await config.flightSuretyData.getFlightKey(
      airlines[0].address,
      flight
    )
    const flightStatus = await config.flightSuretyData.getFlight(flightKey)

    assert(
      parseInt(flightStatus[1].toNumber()) == STATUS_CODE_ON_TIME,
      "Flight status code should be changed to 10 (on time)"
    )
  })
})
