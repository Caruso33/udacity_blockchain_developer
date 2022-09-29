pragma solidity >0.5.1;
pragma experimental ABIEncoderV2;

// TODO define a contract call to the zokrates generated solidity contract <Verifier> or <renamedVerifier>
import "./verifier.sol";
import "./ERC721Mintable.sol";

contract ZokratesVerifier is Verifier {}

// TODO define another contract named SolnSquareVerifier that inherits from your ERC721Mintable class
contract SolnSquareVerifier is ERC721Token {
    ZokratesVerifier public zokratesContract;

    // TODO define a solutions struct that can hold an index & an address
    struct Solution {
        address owner;
        uint256 index;
    }

    // TODO define an array of the above struct
    Solution[] solutionArray;

    // TODO define a mapping to store unique solutions submitted
    mapping(bytes32 => Solution) uniqueSolutions;

    // TODO Create an event to emit when a solution is added
    event SolutionAdded(
        address indexed owner,
        uint256 indexed index,
        bytes32 key
    );

    constructor(
        address verifierAddress,
        string memory name,
        string memory symbol
    ) public ERC721Token(name, symbol) {
        zokratesContract = ZokratesVerifier(verifierAddress);
    }

    // TODO Create a function to add the solutions to the array and emit the event
    function addSolution(
        address _owner,
        uint256 _index,
        bytes32 _key
    ) public {
        Solution memory solution = Solution(_owner, _index);

        solutionArray.push(solution);

        uniqueSolutions[_key] = solution;

        emit SolutionAdded(_owner, _index, _key);
    }

    // TODO Create a function to mint new NFT only after the solution has been verified
    //  - make sure the solution is unique (has not been used before)
    //  - make sure you handle metadata as well as tokenSupply
    function mintToken(
        address _to,
        uint256 _index,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[2] memory input
    ) public {
        bytes32 key = keccak256(abi.encodePacked(a, b, c, input));

        require(
            uniqueSolutions[key].owner == address(0x0),
            "This solution has already been used"
        );

        require(
            zokratesContract.verifyTx(a, b, c, input),
            "Solution is incorrect"
        );

        addSolution(_to, _index, key);

        mint(_to, _index);
    }
}
