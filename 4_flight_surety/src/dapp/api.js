import web3 from "web3"
import { contract } from "./index"
import { onPastEvent, onEvent } from "./ui"
export {
  getPastAppLogs,
  getPastDataLogs,
  getAllAppEvents,
  getAllDataEvents,
  onAuthorizeAppContract,
  getDataContractStatus,
  setDataContractStatus,
  getAirlines,
  registerNewAirlines,
  fundAirline,
  voteForAirline,
  registerFlight,
  getFlightKeys,
  getFlightKey,
  getFlight,
  requestFlightStatus,
  freezeFlight,
  getRegisteredPayouts,
  payoutInsurees,
  buyInsurance,
}

function getPastAppLogs() {
  contract.flightSuretyApp
    .getPastEvents("allEvents", { fromBlock: 0 })
    .then((events) => {
      for (const event of events.reverse()) {
        const returnValues = JSON.stringify(event.returnValues, null, 2)
        const msg = `${event.event}: ${returnValues}`

        console.log(`flightSuretyApp.getPastEvents event: ${msg}`)
        onPastEvent("flightSuretyApp", msg)
      }
    })
}

function getPastDataLogs() {
  contract.flightSuretyData
    .getPastEvents("allEvents", { fromBlock: 0 })
    .then((events) => {
      for (const event of events.reverse()) {
        const returnValues = JSON.stringify(event.returnValues, null, 2)
        const msg = `${event.event}: ${returnValues}`

        console.log(`flightSuretyData.getPastEvents event: ${msg}`)
        onPastEvent("flightSuretyData", msg)
      }
    })
}

function getAllAppEvents() {
  contract.flightSuretyApp.events.allEvents((error, event) => {
    const returnValues = JSON.stringify(event.returnValues, null, 2)
    const msg = `${event.event}: ${returnValues}`

    console.log(
      `flightSuretyApp.getAllAppEvents error: ${error}, event: ${msg}`
    )
    onEvent("flightSuretyApp", msg)
  })
}

function getAllDataEvents() {
  contract.flightSuretyData.events.allEvents((error, event) => {
    const returnValues = JSON.stringify(event.returnValues, null, 2)
    const msg = `${event.event}: ${returnValues}`

    console.log(
      `flightSuretyData.getAllDataEvents error: ${error}, event: ${msg}`
    )
    onEvent("flightSuretyData", msg)
  })
}

function onAuthorizeAppContract() {
  contract.flightSuretyData.methods
    .authorizeCaller(contract.flightSuretyAppAddress)
    .send({ from: contract.owner }, (error, _result) => {
      if (error) {
        console.log(error.message)
        return
      }

      console.log("App address is authorized")
    })
}

function getDataContractStatus() {
  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods.isOperational().call((error, result) => {
      if (error) {
        console.error(error.message)
        return reject(error)
      }

      console.log(`Data contract is ${!result ? "not " : ""}operational`)

      resolve(result)
    })
  })
}

function setDataContractStatus(mode) {
  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .setOperatingStatus(mode)
      .send({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(
          `Data contract is now set ${!mode ? "not " : ""}operational`
        )

        resolve(result)
      })
  })
}

function getAirlines() {
  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .getAirlines()
      .call({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        const [airlineAddresses, airlineNames, airlineStatus] = [
          result[0],
          result[1],
          result[2],
        ]

        console.log(
          `getAirlines success ${result[0].length} active, ${result[1].length} registered, ${result[2].length} unregistered`
        )

        const airlines = []

        for (let i = 0; i < airlineAddresses.length; i++) {
          const airline = {
            address: airlineAddresses[i],
            name: airlineNames[i],
            status: airlineStatus[i],
          }

          airlines.push(airline)

          console.log(
            `${
              airline.status[0].toUpperCase() + airline.status.slice(1)
            } airline address: ${airline.address}, name: ${airline.name}`
          )
        }

        resolve(airlines)
      })
  })
}

function registerNewAirlines(airlineName, airlineAdress) {
  if (airlineAdress === "Airline") {
    return alert("Please select correct airline")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyApp.methods
      .createAirline(airlineName, airlineAdress)
      .send({ from: contract.owner, gas: "5000000" }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Airline registered: ${result}`)

        resolve(result)
      })
  })
}

function fundAirline(airlineAddress, amount) {
  if (airlineAddress == "Funding Airline") {
    return alert("Please select correct airline")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyApp.methods.provideAirlinefunding(airlineAddress).send(
      {
        from: airlineAddress,
        value: web3.utils.toWei(amount),
        gas: "5000000",
      },
      (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Airline funded: ${result}`)

        resolve(result)
      }
    )
  })
}

function voteForAirline(airlineToVoteFor, votingAirline) {
  if (
    airlineToVoteFor === "Airline to Vote for" ||
    votingAirline === "Voting Airline"
  ) {
    return alert("Please select correct airlines")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyApp.methods
      .voteForAirline(airlineToVoteFor)
      .send({ from: votingAirline, gas: "5000000" }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Airline voted for: ${result}`)

        resolve(result)
      })
  })
}

function registerFlight(airlineAddress, flightName, insuranceAmount) {
  if (airlineAddress === "Airlines") {
    return alert("Please select a correct airline")
  } else if (flightName === "") {
    return alert("Please provide a flight name")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .registerFlightForInsurance(
        airlineAddress,
        flightName,
        web3.utils.toWei(insuranceAmount)
      )
      .send(
        { from: airlineAddress, gas: web3.utils.toWei("5", "mwei") },
        (error, result) => {
          if (error) {
            console.error(error.message)
            return reject(error)
          }

          console.log(`Registered flight for insurance: ${result}`)

          resolve(result)
        }
      )
  })
}

function getFlightKeys(airlineAddress) {
  if (airlineAddress === "Airlines") {
    return alert("Please select a correct airline")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .getFlightKeys(airlineAddress)
      .call({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Airline flightkeys: ${result}`)

        resolve(result)
      })
  })
}

function getFlightKey(airlineAddress, flightName) {
  if (airlineAddress === "Airlines") {
    return alert("Please select a correct airline")
  } else if (flightName === "") {
    return alert("Please select a correct flight")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .getFlightKey(airlineAddress, flightName)
      .call({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Airline flightkey: ${result}`)

        resolve(result)
      })
  })
}

function getFlight(flightKey) {
  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .getFlight(flightKey)
      .call({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        const flight = {
          name: result[0],
          statusCode: result[1],
          registeredTimestamp: result[2],
          freezeTimestamp: result[3],
          lastUpdatedTimestamp: result[4],
          airline: result[5],
          landed: result[6],
          insurancePrice: result[7],
          insureeAddresses: result[8],
        }

        console.log(`Flight: ${JSON.stringify(flight)}`)

        resolve(flight)
      })
  })
}

function requestFlightStatus(airlineAddress, flightName) {
  if (airlineAddress === "Airlines") {
    return alert("Please select a correct airline")
  } else if (flightName === "") {
    return alert("Please provide a flight name")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyApp.methods
      .requestFlightStatus(airlineAddress, flightName)
      .send({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Flight status requested: ${JSON.stringify(result)}`)

        resolve(result)
      })
  })
}

function freezeFlight(airlineAddress, flightName) {
  if (airlineAddress === "Airlines") {
    return alert("Please select a correct airline")
  } else if (flightName === "") {
    return alert("Please provide a flight name")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .freezeFlight(airlineAddress, flightName)
      .send({ from: airlineAddress }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Flight is frozen: ${JSON.stringify(result)}`)

        resolve(result)
      })
  })
}

function getRegisteredPayouts(airlineAddress, flightName) {
  if (airlineAddress === "Airlines") {
    return alert("Please select a correct airline")
  } else if (flightName === "") {
    return alert("Please provide a flight name")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .getRegisteredPayouts(airlineAddress, flightName)
      .call({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        const numberInsurees = result[0]
        const payoutAmount = result[1]
        const payoutAddresses = result[2]

        console.log(
          `Registered payouts for flight ${flightName} Number of Insurees ${numberInsurees}, Payout Amount ${payoutAmount}, Payout Addresses ${payoutAddresses}`
        )

        resolve([numberInsurees, payoutAmount, payoutAddresses])
      })
  })
}

function payoutInsurees(airlineAddress, flightName) {
  if (airlineAddress === "Airlines") {
    return alert("Please select a correct airline")
  } else if (flightName === "") {
    return alert("Please provide a flight name")
  }

  return new Promise((resolve, reject) => {
    contract.flightSuretyApp.methods
      .payoutInsurees(airlineAddress, flightName)
      .send({ from: contract.owner }, (error, result) => {
        if (error) {
          console.error(error.message)
          return reject(error)
        }

        console.log(`Flight insurees paid out: ${result}`)

        resolve(result)
      })
  })
}

function buyInsurance(
  airlineAddress,
  flightName,
  insureeAddress,
  insuranceAmount
) {
  return new Promise((resolve, reject) => {
    contract.flightSuretyData.methods
      .buyInsuranceForFlight(airlineAddress, flightName)
      .send(
        {
          from: insureeAddress,
          value: web3.utils.toWei(`${insuranceAmount}`),
          gas: web3.utils.toWei("5", "mwei"),
        },
        (error, result) => {
          if (error) {
            console.error(error.message)
            return reject(error)
          }

          console.log(`Flight insuree bought: ${result}`)

          resolve(result)
        }
      )
  })
}
