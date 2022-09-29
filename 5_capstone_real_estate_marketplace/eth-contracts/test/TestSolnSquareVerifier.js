// Test if a new solution can be added for contract - SolnSquareVerifier
const ZokratesVerifier = artifacts.require("ZokratesVerifier")
const SolnSquareVerifier = artifacts.require("SolnSquareVerifier")
const proof = require("../../zokrates/proof")
const truffleAssert = require("truffle-assertions")

contract("SolnSquareVerifier", (accounts) => {
  let contract = null

  const account_one = accounts[0]
  const account_two = accounts[1]

  beforeEach(async () => {
    const zokratesVerifier = await ZokratesVerifier.new({ from: account_one })
    contract = await SolnSquareVerifier.new(
      zokratesVerifier.address,
      "Real Estate Tokens",
      "RET",
      { from: account_one }
    )
  })

  it("Test if a new solution can be added for contract - SolnSquareVerifier", async function () {
    const event = await contract.mintToken(
      account_two,
      1,
      proof.proof.a,
      proof.proof.b,
      proof.proof.c,
      proof.inputs,
      { from: account_one }
    )

    truffleAssert.eventEmitted(event, "SolutionAdded")

    assert.equal(
      event.logs[0].event,
      "SolutionAdded",
      "Failed to add a solution"
    )
  })

  it("Test if an ERC721 token can be minted for contract - SolnSquareVerifier", async function () {
    let minted = true
    try {
      await contract.mintToken(
        account_two,
        1,
        proof.proof.a,
        proof.proof.b,
        proof.proof.c,
        proof.inputs,
        { from: account_one }
      )
    } catch (e) {
      console.error(e.message)
      minted = false
    }

    assert.equal(minted, true, "token was not minted")
  })
})
