import web3 from "web3"
import {
  buyInsurance,
  freezeFlight,
  fundAirline,
  getAirlines,
  getAllAppEvents,
  getAllDataEvents,
  getDataContractStatus,
  getFlight,
  getFlightKey,
  getFlightKeys,
  getPastAppLogs,
  getPastDataLogs,
  getRegisteredPayouts,
  onAuthorizeAppContract,
  payoutInsurees,
  registerFlight,
  registerNewAirlines,
  requestFlightStatus,
  setDataContractStatus,
  voteForAirline,
} from "./api"
import Contract from "./contract"
import "./flightsurety.css"
import { filterUniqAirlines, filterUniqFlights } from "./utils"

export { contract }

let contract = null

;(async () => {
  contract = await new Contract("localhost")

  // get events
  getPastAppLogs()
  getPastDataLogs()
  getAllAppEvents()
  getAllDataEvents()

  // set contract addresses
  $("#app-contract-address").val(contract.flightSuretyAppAddress)
  $("#data-contract-address").val(contract.flightSuretyDataAddress)

  getDataContractStatus().then((result) => {
    const operationRadios = $("input:radio[name=data-isoperational]")
    operationRadios.filter(`[value=${result}]`).prop("checked", true)
  })

  for (const airlineAddress of contract.airlines) {
    $("#new-airline-address").append(
      $("<option>", { value: airlineAddress, text: airlineAddress })
    )
  }

  for (const insureeAddress of contract.insurees) {
    $("#flight-insurance-insurees").append(
      $("<option>", { value: insureeAddress, text: insureeAddress })
    )
  }

  // onClick handler
  $("#authorize-app-contract").click(onAuthorizeAppContract)
  $("#get-data-contract-status").click(async () => {
    const mode = await getDataContractStatus()
    const operationRadios = $("input:radio[name=data-isoperational]")
    operationRadios.filter(`[value=${mode}]`).prop("checked", true)
  })
  $("#set-data-contract-status").click(() => {
    const operationRadio = $(
      "input:radio[name=data-isoperational]:checked"
    ).val()

    setDataContractStatus(operationRadio === "true" ? true : false)
  })

  $("[name=get-airlines]").each((_i, element) => {
    $(element).click(async () => {
      const airlines = await getAirlines()

      const activeAirlines = airlines.filter(
        (airline) => airline.status === "active"
      )
      const registeredAirlines = airlines.filter(
        (airline) => airline.status === "registered"
      )
      const unRegisteredAirlines = airlines.filter(
        (airline) => airline.status === "unregistered"
      )

      const activeSelection = [
        $("#active-airlines"),
        $("#flight-airlines"),
        $("#status-airlines"),
        $("#insurance-airlines"),
      ]
      activeSelection.forEach((select) => {
        activeAirlines
          .filter((airline) => filterUniqAirlines(airline, select))
          .forEach((airline) => {
            select.append(
              $("<option>", { value: airline.address, text: airline.name })
            )
          })
      })

      const registeredSelection = [
        $("#registered-airlines"),
        $("#funding-airlines"),
        $("#voting-airline"),
      ]
      registeredSelection.forEach((select) => {
        registeredAirlines
          .filter((airline) => filterUniqAirlines(airline, select))
          .forEach((airline) => {
            select.append(
              $("<option>", { value: airline.address, text: airline.name })
            )
          })
      })

      const unRegisteredSelection = [
        $("#unregistered-airlines"),
        $("#airline-to-vote-for"),
      ]
      unRegisteredSelection.forEach((select) => {
        unRegisteredAirlines
          .filter((airline) => filterUniqAirlines(airline, select))
          .forEach((airline) => {
            select.append(
              $("<option>", { value: airline.address, text: airline.name })
            )
          })
      })
    })
  })

  $("#register-new-airline").click(() => {
    const airlineName = $("#new-airline-name").val()
    const airlineAdress = $("#new-airline-address").val()

    registerNewAirlines(airlineName, airlineAdress)
  })

  $("#fund-airline").click(() => {
    const fundAirlineAddress = $("#funding-airlines").val()
    const fundAirlineAmount = $("#fund-airline-amount").val()

    fundAirline(fundAirlineAddress, fundAirlineAmount)
  })

  $("#vote-airline").click(() => {
    const airlineToVoteFor = $("#airline-to-vote-for").val()
    const votingAirline = $("#voting-airline").val()

    voteForAirline(airlineToVoteFor, votingAirline)
  })

  $("#register-flight").click(() => {
    const airlineAddress = $("#flight-airlines").val()
    const flightName = $("#flight-name").val()
    const insuranceAmount = $("#insurance-amount").val()

    registerFlight(airlineAddress, flightName, insuranceAmount)
  })

  $("#get-flights-management,#get-flights-status,#get-flights-passenger").each(
    (_i, element) =>
      $(element).click(async () => {
        let airlineAddress = null

        if (element.id.includes("passenger"))
          airlineAddress = $("#insurance-airlines").val()
        if (element.id.includes("status"))
          airlineAddress = $("#status-airlines").val()
        else airlineAddress = $("#flight-airlines").val()

        const flightKeys = await getFlightKeys(airlineAddress)

        const flights = await Promise.all(
          flightKeys.map((flightKey) => getFlight(flightKey))
        )

        const selector = [
          $("#airline-flights"),
          $("#status-flights"),
          $("#insurance-flights"),
        ]

        selector.forEach((select) => {
          flights
            .filter((flight) => filterUniqFlights(flight, select))
            .forEach((flight) => {
              select.append(
                $("<option>", { value: flight.name, text: flight.name })
              )
            })
        })
      })
  )

  $("#get-flight-status").click(async () => {
    const statusCodeMapping = {
      0: "UNKNOWN",
      10: "ON_TIME",
      20: "LATE_AIRLINE",
      30: "LATE_WEATHER",
      40: "LATE_TECHNICAL",
      50: "LATE_OTHER",
    }

    const airlineAddress = $("#status-airlines").val()
    const flightName = $("#status-flights").val()

    const flightKey = await getFlightKey(airlineAddress, flightName)
    const flight = await getFlight(flightKey)

    $("#flight-status").val(
      `${flight.statusCode} --> ${statusCodeMapping[flight.statusCode]}`
    )
    $("#flight-freezeTimestamp").val(
      flight.freezeTimestamp == 0
        ? flight.freezeTimestamp
        : new Date(1000 * flight.freezeTimestamp)
    )
    $("#flight-lastUpdatedTimestamp").val(
      new Date(1000 * flight.lastUpdatedTimestamp)
    )

    $("#flight-landed").val(flight.landed)
    $("#flight-insurancePrice").val(
      web3.utils.fromWei(flight.insurancePrice, "ether")
    )
    $("#flight-insuranceaddresses").val(flight.insureeAddresses.length)
  })

  $("#request-flight-status").click(() => {
    const airlineAddress = $("#status-airlines").val()
    const flightName = $("#status-flights").val()

    requestFlightStatus(airlineAddress, flightName)
  })

  $("#freeze-flight").click(() => {
    const airlineAddress = $("#flight-airlines").val()
    const flightName = $("#flight-name").val()

    freezeFlight(airlineAddress, flightName)
  })

  $("#get-registered-payouts").click(async () => {
    const airlineAddress = $("#flight-airlines").val()
    const flightName = $("#flight-name").val()

    const [numberInsurees, payoutAmount, payoutAddresses] =
      await getRegisteredPayouts(airlineAddress, flightName)

    $("#number-insurees").val(numberInsurees)
    $("#payout-amount").val(web3.utils.fromWei(payoutAmount, "ether"))
    $("#payout-addresses").val(payoutAddresses.length)
  })

  $("#payout-insurees").click(() => {
    const airlineAddress = $("#flight-airlines").val()
    const flightName = $("#flight-name").val()

    payoutInsurees(airlineAddress, flightName)
  })

  $("#buy-insurance").click(() => {
    const airlineAddress = $("#insurance-airlines").val()
    const flightName = $("#insurance-flights").val()
    const insureeAddress = $("#flight-insurance-insurees").val()
    const insuranceAmount = $("#insurance-amount").val()

    buyInsurance(airlineAddress, flightName, insureeAddress, insuranceAmount)
  })
})()
