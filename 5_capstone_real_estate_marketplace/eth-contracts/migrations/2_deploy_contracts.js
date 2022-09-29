// migrating the appropriate contracts
const ZokratesVerifier = artifacts.require("./ZokratesVerifier.sol")
const SolnSquareVerifier = artifacts.require("./SolnSquareVerifier.sol")

module.exports = async (deployer) => {
  await deployer.deploy(ZokratesVerifier)

  await deployer.deploy(
    SolnSquareVerifier,
    ZokratesVerifier.address,
    "Real Estate Marketplace Token",
    "REMT"
  )

  console.log("Zokrates address:", ZokratesVerifier.address)
  console.log("SolnSquare address:", SolnSquareVerifier.address)
}
