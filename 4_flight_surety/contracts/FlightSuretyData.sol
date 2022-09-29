pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

// import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v2.0.1/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    struct Airline {
        string name;
        address account;
        // registered through voting (automatically if less than 4 airlines) and up to provide funding
        bool isRegistered;
        // funded and active
        bool isActive;
        // if more than 3 airlines exist, they have to vote in order to let other airlines join the contract
        uint256 votes;
        uint256 insuranceBalance;
    }

    struct Insuree {
        address account;
        uint256 insuranceAmount;
        bool isCredited;
    }

    struct Flight {
        string name;
        uint8 statusCode;
        uint256 registeredTimestamp;
        uint256 freezeTimestamp;
        uint256 lastUpdatedTimestamp;
        address airline;
        bool landed;
        uint256 insurancePrice;
        address[] insureeAddresses;
        mapping(address => Insuree) insurees;
    }

    // general vars
    bool private operational = true; // Blocks all state changes throughout the contract if false
    address private contractOwner; // Account used to deploy contract

    uint256 public returnUncreditedInsurancesLockTime = 60 * 60 * 24 * 365; // 365

    uint256 authorizedContractCount = 0; // Number of contracts authorized to operate the contract
    mapping(address => bool) private authorizedContracts; // allowed to call the data contract

    uint256 initialAirlineFunding = 10 ether; // what airlines have to bring in initially
    uint256 registeredAirlineCount = 0; // Number of airlines registered
    uint256 activeAirlineCount = 0; // Number of airlines registered and active

    address[] airlineAddresses = new address[](0); // Array of addresses of airlines
    mapping(address => Airline) airlines;
    mapping(address => mapping(address => bool)) airlineRegistrationVotes;

    mapping(address => bytes32[]) airlineFlights;
    mapping(bytes32 => Flight) flights;

    mapping(bytes32 => Insuree[]) registeredPayouts;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AuthorizeCaller(address contractAddress);
    event DeauthorizeCaller(address contractAddress);

    event AirlineCreated(address airlineAddress, string airlineName);
    event AirlineRegistered(
        address airlineAddress,
        string airlineName,
        uint256 registeredAirlineCount
    );
    event AirlineRegistrationVoted(
        address airlineAddress,
        string airlineName,
        address voter
    );
    event AirlineFunded(address airlineAddress, string airlineName);

    event FlightRegistered(
        address airlineAddress,
        string airlineName,
        string flightName,
        uint256 timestamp,
        uint256 insurancePrice
    );
    event FlightFrozen(
        address airlineAddress,
        string airlineName,
        string flightName,
        uint256 timestamp
    );
    event FlightInsuranceBought(
        address airlineAddress,
        string airlineName,
        string flightName,
        uint256 timestamp,
        address insureeAddress,
        uint256 insurancePrice
    );
    event CreditInsuree(
        address airlineAddress,
        string airlineName,
        string flightName,
        address insureeAddress,
        uint256 insuranceAmount
    );
    event PayoutInsurance(
        string flightName,
        address insureeAddress,
        uint256 payoutAmount
    );
    event ReturnUncreditedInsurance(
        address airlineAddress,
        string airlineName,
        string flightName,
        address insureeAddress,
        uint256 insuranceAmount
    );

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor() public {
        contractOwner = msg.sender;
        authorizeCaller(msg.sender);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAirlineExist(address airlineAddress) {
        require(
            airlines[airlineAddress].account != address(0),
            "Airline does not exists"
        );
        _;
    }

    modifier requireAirlineRegistered(address airlineAddress) {
        require(
            airlines[airlineAddress].isRegistered,
            "Airline is not registered"
        );
        _;
    }

    modifier requireAirlineAuthorized() {
        require(
            airlines[tx.origin].isActive,
            "Airline is not authorized, i.e. active through funding"
        );
        _;
    }

    /**
     * @dev Modifier that requires the sender account to be one of the authorized accounts
     */
    modifier requireCallerAuthorized() {
        require(
            authorizedContracts[msg.sender] || authorizedContracts[tx.origin],
            "Caller is not authorized"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns (bool) {
        return operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function isAirlineRegistered(address airlineAddress)
        external
        view
        returns (bool)
    {
        Airline storage airline = airlines[airlineAddress];
        return airline.isRegistered;
    }

    function isAirlineActive(address airlineAddress)
        external
        view
        returns (bool)
    {
        Airline storage airline = airlines[airlineAddress];
        return airline.isRegistered && airline.isActive;
    }

    /********************************************************************************************/
    /*                                     CALLER ACCESS MANAGEMENT                             */
    /********************************************************************************************/

    function authorizeCaller(address contractAddress)
        public
        requireContractOwner
    {
        if (!authorizedContracts[contractAddress]) {
            authorizedContractCount = authorizedContractCount.add(1);
            emit AuthorizeCaller(contractAddress);
        }

        authorizedContracts[contractAddress] = true;
    }

    function deauthorizeCaller(address contractAddress)
        external
        requireContractOwner
    {
        if (authorizedContracts[contractAddress]) {
            emit DeauthorizeCaller(contractAddress);
            delete authorizedContracts[contractAddress];
        }
    }

    function isAuthorizedCaller(address contractAddress)
        external
        view
        returns (bool)
    {
        return authorizedContracts[contractAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    // getter functions
    function getInitialFunding() public view returns (uint256) {
        return initialAirlineFunding;
    }

    function getRegisteredAirlineCount() public view returns (uint256) {
        return registeredAirlineCount;
    }

    function getActiveAirlineCount() public view returns (uint256) {
        return activeAirlineCount;
    }

    function getReturnUncreditedInsurancesLockTime()
        public
        view
        returns (uint256)
    {
        return returnUncreditedInsurancesLockTime;
    }

    function getAirlines()
        public
        view
        returns (
            address[],
            string[],
            string[]
        )
    {
        address[] memory addresses = new address[](airlineAddresses.length);
        string[] memory names = new string[](airlineAddresses.length);
        string[] memory status = new string[](airlineAddresses.length);

        for (uint256 i = 0; i < airlineAddresses.length; i++) {
            address currentAirlineAddress = airlineAddresses[i];
            string storage currentAirlineName = airlines[currentAirlineAddress]
                .name;

            if (airlines[currentAirlineAddress].isActive) {
                addresses[i] = currentAirlineAddress;
                names[i] = currentAirlineName;
                status[i] = "active";
            } else if (airlines[currentAirlineAddress].isRegistered) {
                addresses[i] = currentAirlineAddress;
                names[i] = currentAirlineName;
                status[i] = "registered";
            } else {
                addresses[i] = currentAirlineAddress;
                names[i] = currentAirlineName;
                status[i] = "unregistered";
            }
        }

        return (addresses, names, status);
    }

    function getAirline(address airlineAddress)
        public
        view
        returns (
            string,
            address,
            bool,
            bool,
            uint256,
            uint256
        )
    {
        Airline storage airline = airlines[airlineAddress];
        return (
            airline.name,
            airline.account,
            airline.isRegistered,
            airline.isActive,
            airline.votes,
            airline.insuranceBalance
        );
    }

    function getFlightKeys(address airlineAddress)
        public
        view
        returns (bytes32[])
    {
        bytes32[] memory airlineFlightKeys = airlineFlights[airlineAddress];
        return airlineFlightKeys;
    }

    function getFlightKey(address airlineAddress, string flightName)
        public
        pure
        returns (bytes32)
    {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);
        return flightKey;
    }

    function getFlight(bytes32 flightKey)
        public
        view
        returns (
            string,
            uint8,
            uint256,
            uint256,
            uint256,
            address,
            bool,
            uint256,
            address[]
        )
    {
        Flight storage flight = flights[flightKey];
        return (
            flight.name,
            flight.statusCode,
            flight.registeredTimestamp,
            flight.freezeTimestamp,
            flight.lastUpdatedTimestamp,
            flight.airline,
            flight.landed,
            flight.insurancePrice,
            flight.insureeAddresses
        );
    }

    function getInsuree(
        address airlineAddress,
        string flightName,
        address insureeAddress
    )
        public
        view
        returns (
            address,
            uint256,
            bool
        )
    {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);
        Flight storage flight = flights[flightKey];

        Insuree storage insuree = flight.insurees[insureeAddress];

        return (insuree.account, insuree.insuranceAmount, insuree.isCredited);
    }

    function getRegisteredPayouts(address airlineAddress, string flightName)
        public
        view
        returns (
            uint256,
            uint256,
            address[]
        )
    {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);
        Insuree[] storage insurees = registeredPayouts[flightKey];

        uint256 payoutInsurees = 0;
        uint256 payoutAmount = 0;
        address[] memory payoutAddresses = new address[](insurees.length);

        for (uint256 i = 0; i < insurees.length; i++) {
            Insuree storage insuree = insurees[i];

            payoutInsurees = payoutInsurees.add(1);
            payoutAmount = payoutAmount.add(insuree.insuranceAmount);
            payoutAddresses[i] = insuree.account;
        }

        return (payoutInsurees, payoutAmount, payoutAddresses);
    }

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function createAirline(string airlineName, address airlineAddress)
        external
        requireIsOperational
        requireCallerAuthorized
        returns (uint256)
    {
        require(
            airlines[airlineAddress].account == address(0),
            "Airline already exists"
        );

        // the first 3 airlines are registered automatically
        // after that, the voting mechanism decides which additional airline gets registered
        bool isRegistered = registeredAirlineCount < 3 ? true : false;

        Airline memory airline = Airline({
            name: airlineName,
            account: airlineAddress,
            isRegistered: isRegistered,
            isActive: false,
            votes: 0,
            insuranceBalance: 0
        });

        airlineAddresses.push(airlineAddress);
        airlines[airlineAddress] = airline;

        emit AirlineCreated(airlineAddress, airlineName);

        if (isRegistered) {
            registeredAirlineCount = registeredAirlineCount.add(1);
            emit AirlineRegistered(
                airlineAddress,
                airlineName,
                registeredAirlineCount
            );
        }

        return registeredAirlineCount;
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function provideAirlinefunding(address airlineAddress)
        public
        payable
        requireIsOperational
        requireAirlineExist(airlineAddress)
        requireAirlineRegistered(airlineAddress)
        returns (uint256)
    {
        Airline storage airline = airlines[airlineAddress];

        if (!airline.isActive) {
            require(msg.value >= initialAirlineFunding, "Insufficient funding");

            airline.isActive = true;
            activeAirlineCount = activeAirlineCount.add(1);
            emit AirlineFunded(airlineAddress, airline.name);
        }

        airline.insuranceBalance = airline.insuranceBalance.add(msg.value);

        return airline.insuranceBalance;
    }

    function voteForAirline(address airlineAddress)
        external
        requireAirlineExist(airlineAddress)
        requireAirlineAuthorized
        returns (uint256)
    {
        Airline storage airline = airlines[airlineAddress];

        require(
            !airlineRegistrationVotes[airlineAddress][tx.origin],
            "Airline has already been voted for by sender"
        );

        airlineRegistrationVotes[airlineAddress][tx.origin] = true;

        airline.votes = airline.votes.add(1);

        emit AirlineRegistrationVoted(airlineAddress, airline.name, tx.origin);

        // register if at least half or more authorizedContracts voted for the airline
        if (airline.votes * 2 > activeAirlineCount) {
            airline.isRegistered = true;

            registeredAirlineCount = registeredAirlineCount.add(1);

            emit AirlineRegistered(
                airlineAddress,
                airline.name,
                registeredAirlineCount
            );
        }

        return airline.votes;
    }

    // function drainAirlineFunding(address airlineAddress) {
    //     Airline storage airline = airlines[airlineAddress];

    //     require(
    //         airline.insuranceBalance >= initialAirlineFunding,
    //         "Not enough insurance funds to drain account"
    //     );
    //     uint256 amount = airline;
    //     tx.origin.transfer(amount);
    // }

    /**
     * @dev Registers a new flight to buy insurance for
     *
     */
    function registerFlightForInsurance(
        address airlineAddress,
        string flightName,
        uint256 insurancePrice
    ) external requireIsOperational requireAirlineAuthorized {
        Airline storage airline = airlines[airlineAddress];

        require(airline.account != address(0), "Airline does not exist");
        require(
            airlineAddress == tx.origin,
            "Cannot register flight insurance for another airline"
        );
        require(
            airline.insuranceBalance >= insurancePrice.mul(1000),
            "Insufficient funds to register flight, provide more funding"
        );

        uint256 timestamp = block.timestamp;
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);
        address[] memory emptyArray;

        Flight memory flight = Flight({
            name: flightName,
            statusCode: 0,
            registeredTimestamp: timestamp,
            freezeTimestamp: 0,
            lastUpdatedTimestamp: timestamp,
            airline: airlineAddress,
            landed: false,
            insurancePrice: insurancePrice,
            insureeAddresses: emptyArray
        });

        flights[flightKey] = flight;

        airlineFlights[airlineAddress].push(flightKey);

        emit FlightRegistered(
            airlineAddress,
            airline.name,
            flightName,
            timestamp,
            insurancePrice
        );
    }

    function freezeFlight(address airlineAddress, string flightName)
        external
        requireIsOperational
        requireAirlineAuthorized
    {
        Airline storage airline = airlines[airlineAddress];

        require(
            airline.account == tx.origin,
            "Cannot freeze flight insurance for another airline"
        );

        bytes32 flightKey = getKey(airlineAddress, flightName, 0);

        Flight storage flight = flights[flightKey];

        require(flight.airline != address(0), "Flight does not exist");
        require(flight.freezeTimestamp == 0, "Flight is already frozen");

        uint256 freezeTimestamp = block.timestamp;

        flight.freezeTimestamp = freezeTimestamp;

        emit FlightFrozen(
            airlineAddress,
            airline.name,
            flightName,
            freezeTimestamp
        );
    }

    // /**
    //  * @dev Buy insurance for a flight
    //  *
    //  */
    function buyInsuranceForFlight(address airlineAddress, string flightName)
        external
        payable
        requireIsOperational
    {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);

        Flight storage flight = flights[flightKey];

        require(flight.airline != address(0), "Flight does not exist");

        require(
            flight.insurees[tx.origin].account == address(0),
            "You already bought insurance for this flight"
        );

        require(msg.value >= flight.insurancePrice, "Insufficient amount");

        require(
            flight.freezeTimestamp == 0,
            "Flight is frozen, it's too late to buy insurance for this flight"
        );

        Insuree memory insuree = Insuree({
            account: tx.origin,
            insuranceAmount: msg.value,
            isCredited: false
        });
        flight.insureeAddresses.push(tx.origin);
        flight.insurees[tx.origin] = insuree;

        if (msg.value > flight.insurancePrice) {
            uint256 overpayedAmount = msg.value.sub(flight.insurancePrice);
            tx.origin.transfer(overpayedAmount);
        }

        emit FlightInsuranceBought(
            airlineAddress,
            airlines[airlineAddress].name,
            flightName,
            block.timestamp,
            tx.origin,
            flight.insurancePrice
        );
    }

    function creditInsurees(address airlineAddress, string flightName)
        internal
        requireIsOperational
        requireCallerAuthorized
        returns (address[])
    {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);
        Flight storage flight = flights[flightKey];

        require(flight.airline != address(0), "Flight does not exist");

        require(
            flight.freezeTimestamp != 0,
            "Flight is not frozen, it's too early to credit insurees"
        );

        for (uint256 i = 0; i < flight.insureeAddresses.length; i++) {
            address insureeAddress = flight.insureeAddresses[i];
            Insuree storage insuree = flight.insurees[insureeAddress];

            if (!insuree.isCredited) {
                Airline storage airline = airlines[airlineAddress];
                uint256 insuranceAmount = insuree
                    .insuranceAmount
                    // 1.5 the initial insurance value
                    .mul(15)
                    .div(10);

                insuree.isCredited = true;
                insuree.insuranceAmount = insuranceAmount;

                airline.insuranceBalance = airline.insuranceBalance.sub(
                    insuranceAmount
                );

                registeredPayouts[flightKey].push(insuree);

                emit CreditInsuree(
                    airlineAddress,
                    airlines[airlineAddress].name,
                    flightName,
                    insuree.account,
                    insuree.insuranceAmount
                );
            }
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insurees
     *
     */
    function payoutInsurees(address airlineAddress, string flightName)
        external
        payable
        requireCallerAuthorized
    {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);
        Insuree[] storage insurees = registeredPayouts[flightKey];

        for (uint256 i = 0; i < insurees.length; i++) {
            Insuree storage insuree = insurees[i];

            address insureeAddress = insuree.account;
            uint256 insuranceAmount = insuree.insuranceAmount;

            delete insurees[i];

            insureeAddress.transfer(insuranceAmount);

            emit PayoutInsurance(flightName, insureeAddress, insuranceAmount);
        }
    }

    function returnUncreditedInsurances(
        address airlineAddress,
        string flightName
    ) public requireIsOperational requireAirlineAuthorized {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);

        Flight storage flight = flights[flightKey];

        require(flight.airline != address(0), "Flight does not exist");

        require(
            flight.freezeTimestamp != 0,
            "Flight is not frozen, it's too early to return uncredited insurance"
        );

        require(
            tx.origin == flight.airline,
            "Only particular airline can return uncredited insurance"
        );

        require(
            block.timestamp >=
                flight.freezeTimestamp.add(returnUncreditedInsurancesLockTime),
            "It's too early to return uncredited insurances"
        );

        Insuree[] storage insurees = registeredPayouts[flightKey];

        for (uint256 i = 0; i < insurees.length; i++) {
            Insuree storage insuree = insurees[i];

            Airline storage airline = airlines[airlineAddress];
            airline.insuranceBalance.add(insuree.insuranceAmount);

            emit ReturnUncreditedInsurance(
                airlineAddress,
                airlines[airlineAddress].name,
                flightName,
                insuree.account,
                insuree.insuranceAmount
            );
        }

        delete registeredPayouts[flightKey];
    }

    // setter
    function setFlightStatus(
        address airlineAddress,
        string flightName,
        uint8 statusCode
    ) external requireCallerAuthorized {
        bytes32 flightKey = getKey(airlineAddress, flightName, 0);
        Flight storage flight = flights[flightKey];

        require(flight.airline != address(0), "This flight is not registered");
        require(
            !flight.landed,
            "The status of this flight has already been updated"
        );

        flight.statusCode = statusCode;
        flight.lastUpdatedTimestamp = block.timestamp;

        // Status other than 0 sets the flight landed variable to true
        if (statusCode != 0) {
            flights[flightKey].landed = true;
        }

        // Passengers are credited if flight is late due to the airline
        if (statusCode == 20 || statusCode == 40) {
            creditInsurees(airlineAddress, flightName);
        }
    }

    function getKey(
        address keyAddress,
        string memory key,
        uint256 value
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(keyAddress, key, value));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        // provideAirlinefunding();
    }
}
