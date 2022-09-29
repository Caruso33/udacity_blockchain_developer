const web3 = require("web3")

module.exports = {
  getAccounts,
  registerOracles,
  getOracleIndexes,
  onOracleRequest,
  onFlightStatusInfo,
}

function getAccounts(web3, oracleInitialIndex) {
  return new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, accounts) => {
      const oracleAccounts = []

      if (error) {
        console.log("getAccounts: ", error.message)
        return reject(error.message)
      }

      for (let i = 0; i < accounts.length; i++) {
        const oracleAddress = accounts[oracleInitialIndex + i]
        oracleAccounts.push(oracleAddress)
      }
      resolve(oracleAccounts)
    })
  })
}

function getRegistrationFee(flightSuretyApp) {
  return flightSuretyApp.methods.REGISTRATION_FEE().call()
}

function getOracleIndexes(flightSuretyApp, totalOracles, accounts) {
  const promises = []

  for (let i = 0; i < totalOracles; i++) {
    const oracleAddress = accounts[i]

    promises.push(
      new Promise((resolve, reject) => {
        flightSuretyApp.methods
          .getMyIndexes()
          .call({ from: oracleAddress }, (error, result) => {
            if (error) {
              console.error("getOracleIndexes: ", error.message)
              return reject(error.message)
            }

            // console.log(`Oracle ${oracleAddress} has index ${result}`)

            resolve({ [oracleAddress]: result })
          })
      })
    )
  }

  return Promise.all(promises)
}

function registerOracles(flightSuretyApp, oracleAccounts, totalOracles) {
  return getRegistrationFee(flightSuretyApp)
    .then((registrationFee) => {
      const promises = []

      for (let i = 0; i < totalOracles; i++) {
        const oracleAddress = oracleAccounts[i]

        promises.push(
          new Promise((resolve, reject) => {
            flightSuretyApp.methods.registerOracle().send(
              {
                from: oracleAddress,
                value: registrationFee,
                gas: web3.utils.toWei("5", "mwei"),
              },
              (error, result) => {
                if (error) {
                  console.error("registerOracle: ", error.message)
                  return reject(error.message)
                }

                // console.log(`Oracle ${oracleAddress} registered`)

                resolve({ [oracleAddress]: result })
              }
            )
          })
        )
      }

      return Promise.all(promises)
    })
    .catch((e) => console.log(e.message))
}

function onOracleRequest(
  error,
  event,
  flightSuretyApp,
  oracleAccounts,
  oracleIndexes
) {
  const statusCodeMapping = {
    STATUS_CODE_UNKNOWN: 0,
    STATUS_CODE_ON_TIME: 10,
    STATUS_CODE_LATE_AIRLINE: 20,
    STATUS_CODE_LATE_WEATHER: 30,
    STATUS_CODE_LATE_TECHNICAL: 40,
    STATUS_CODE_LATE_OTHER: 50,
  }

  if (error) {
    console.error("onOracleRequest", error.message)
    return
  }

  console.log("onOracleRequest: ", JSON.stringify(event.returnValues, null, 2))

  const eventResult = event.returnValues
  const requestIndex = eventResult.index

  const oracleIndexAccounts = oracleAccounts.filter((oracleAccount) =>
    !oracleIndexes[oracleAccount].includes(requestIndex) ? false : true
  )

  console.log({ oracleIndexAccounts })

  for (let oracleAccount of oracleIndexAccounts) {
    const oracleIndex = oracleIndexes[oracleAccount]

    // const statusCodeLength = Object.keys(statusCodeMapping).length
    // const statusIndex = Math.floor(Math.random() * statusCodeLength)

    const statusIndex = 2 // -> STATUS_CODE_LATE_AIRLINE for testing purpose
    const status =
      statusCodeMapping[Object.keys(statusCodeMapping)[statusIndex]]

    // console.log(
    //   `Response ${
    //     Object.keys(statusCodeMapping)[statusIndex]
    //   }: ${status} from oracle (${oracleIndex.join(", ")}) ${oracleAccount}`
    // )

    console.log({ oracleAccount })

    try {
      flightSuretyApp.methods
        .submitOracleResponse(
          parseInt(requestIndex),
          eventResult.airline,
          eventResult.flight,
          parseInt(eventResult.timestamp),
          parseInt(status)
        )
        .send(
          { from: oracleAccount, gas: web3.utils.toWei("5", "mwei") },
          (error, result) => {
            if (error) {
              console.error(
                `submitOracleResponse send from oracle ${oracleAccount} ${error.message}`
              )
              return
            }

            console.log(
              `Response ${
                Object.keys(statusCodeMapping)[statusIndex]
              }: ${status} from oracle (${oracleIndex.join(
                ", "
              )}) ${oracleAccount}: ${result}`
            )
          }
        )
    } catch (e) {
      console.log("submitOracleResponse ", e.message)
    }
  }
}

function onFlightStatusInfo(error, event) {
  if (error) console.error(error.message)

  console.log(event)
}
