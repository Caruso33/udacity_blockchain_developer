pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    // using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner; // Account used to deploy contract

    FlightSuretyData flightSuretyData; // reference to data contract

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
     * @dev Contract constructor
     *
     */
    constructor(address dataContractAddress) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContractAddress);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *
     */
    function createAirline(string airlineName, address airlineAddress)
        external
        returns (uint256)
    {
        uint256 registeredAirlineCount = flightSuretyData.createAirline(
            airlineName,
            airlineAddress
        );

        return registeredAirlineCount;
    }

    function provideAirlinefunding(address airlineAddress)
        external
        payable
        returns (uint256)
    {
        uint256 airlineInsuranceBalance = flightSuretyData
            .provideAirlinefunding
            .value(msg.value)(airlineAddress);

        return airlineInsuranceBalance;
    }

    function voteForAirline(address airlineAddress) external returns (uint256) {
        uint256 airlineVotes = flightSuretyData.voteForAirline(airlineAddress);

        return airlineVotes;
    }

    // function drainAirlineFunding(address airlineAddress)
    //     external
    //
    // {
    //     flightSuretyData.drainAirlineFunding(airlineAddress);
    // }

    /**
     * @dev Register a future flight for insuring.
     *
     */
    function registerFlightForInsurance(
        address airlineAddress,
        string flightName,
        uint256 insurancePrice
    ) external {
        flightSuretyData.registerFlightForInsurance(
            airlineAddress,
            flightName,
            insurancePrice
        );
    }

    function freezeFlight(address airlineAddress, string flightName) external {
        flightSuretyData.freezeFlight(airlineAddress, flightName);
    }

    function buyInsuranceForFlight(address airlineAddress, string flightName)
        external
        payable
    {
        flightSuretyData.buyInsuranceForFlight(airlineAddress, flightName);
    }

    function payoutInsurees(address airlineAddress, string flightName)
        external
    {
        flightSuretyData.payoutInsurees(airlineAddress, flightName);
    }

    function returnUncreditedInsurances(
        address airlineAddress,
        string flightName
    ) external {
        flightSuretyData.returnUncreditedInsurances(airlineAddress, flightName);
    }

    /**
     * @dev Called after oracle has updated flight status
     *
     */
    function processFlightStatus(
        address airlineAddress,
        string flightName,
        uint8 statusCode
    ) internal {
        require(
            statusCode == STATUS_CODE_UNKNOWN ||
                statusCode == STATUS_CODE_ON_TIME ||
                statusCode == STATUS_CODE_LATE_AIRLINE ||
                statusCode == STATUS_CODE_LATE_WEATHER ||
                statusCode == STATUS_CODE_LATE_TECHNICAL ||
                statusCode == STATUS_CODE_LATE_OTHER,
            "Invalid status code"
        );

        flightSuretyData.setFlightStatus(
            airlineAddress,
            flightName,
            statusCode
        );
    }

    // Generate a request for oracles to fetch flight information
    function requestFlightStatus(address airline, string flight) external {
        uint8 index = getRandomIndex(msg.sender);

        uint256 timestamp = block.timestamp;

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    // ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status,
        address oracle
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    // Register an oracle with the contract
    function registerOracle() external payable {
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() external view returns (uint8[3]) {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle registration"
        );

        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );

        require(
            oracleResponses[key].requester != address(0),
            "Some input parameter do not match oracle request or it doesn't exist"
        );
        require(
            oracleResponses[key].isOpen,
            "Oracle response is already closed, minimum responses met"
        );

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode, msg.sender);

        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, statusCode);
            oracleResponses[key].isOpen = false;
        }
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns (uint8[3]) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }
}
