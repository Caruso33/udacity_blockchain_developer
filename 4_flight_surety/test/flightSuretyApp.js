const Test = require("../config/testConfig.js")
const BigNumber = require("bignumber.js")
const truffleAssert = require("truffle-assertions")
const web3 = require("web3")

contract("Flight Surety Tests", async (accounts) => {
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

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/
  describe.skip("multiparty operational contract status", () => {
    it(`has correct initial isOperational() value`, async function () {
      // Get operating status
      const status = await config.flightSuretyApp.isOperational.call()
      assert.ok(status, "Incorrect initial operating status value")
    })

    it(`can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
      // Ensure that access is denied for non-Contract Owner account
      await truffleAssert.reverts(
        config.flightSuretyApp.setOperatingStatus(false, {
          from: airlines[0].address,
        }),
        "Caller is not contract owner"
      )
    })

    it(`can allow access to setOperatingStatus() for Contract Owner account`, async function () {
      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false
      try {
        await config.flightSuretyApp.setOperatingStatus(false)
        let status = await config.flightSuretyApp.isOperational.call()
        assert.equal(status, false, "Operating status value wasn't changed")
      } catch (e) {
        accessDenied = true
      }
      assert.equal(
        accessDenied,
        false,
        "Access not restricted to Contract Owner"
      )
    })

    it(`can block access to functions using requireIsOperational when operating status is false`, async function () {
      await config.flightSuretyApp.setOperatingStatus(false)

      let reverted = false
      try {
        await config.flightSurety.setTestingMode(true)
      } catch (e) {
        reverted = true
      }
      assert.equal(
        reverted,
        true,
        "Access not blocked for requireIsOperational"
      )

      // Set it back for other tests to work
      await config.flightSuretyApp.setOperatingStatus(true)
    })
  })

  describe("can create airline", () => {
    it("can create an airline", async () => {
      const airlineName = "Airline 001"
      const airlineAddress = airlines[0].address

      const registeredAirlineCountBefore =
        await config.flightSuretyData.getRegisteredAirlineCount()

      await config.flightSuretyApp.createAirline(airlineName, airlineAddress)

      const registeredAirlineCount =
        await config.flightSuretyData.getRegisteredAirlineCount()

      assert(
        registeredAirlineCountBefore == registeredAirlineCount - 1,
        "First airline was not created & registered"
      )
    })

    it("can provide airline funding ", async () => {
      const airlineName = "Airline 001"
      const airlineAddress = airlines[0].address

      await config.flightSuretyApp.createAirline(airlineName, airlineAddress)

      const initialAirlineFunding =
        await config.flightSuretyData.getInitialFunding()

      await config.flightSuretyApp.provideAirlinefunding(airlineAddress, {
        from: airlineAddress,
        // value: web3.utils.toWei(`10`, "ether"),
        value: initialAirlineFunding.toString(),
      })

      const airline = await config.flightSuretyData.getAirline(airlineAddress)
      assert(
        airline[5].toString() == initialAirlineFunding.toString(),
        "Airline was not funded"
      )
    })
  })
})
