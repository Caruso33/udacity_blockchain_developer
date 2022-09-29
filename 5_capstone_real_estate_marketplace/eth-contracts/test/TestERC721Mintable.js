const ERC721Mintable = artifacts.require("ERC721Token")

contract("TestERC721Mintable", (accounts) => {
  const account_one = accounts[0]
  const account_two = accounts[1]
  const account_three = accounts[2]

  beforeEach(async function () {
    this.contract = await ERC721Mintable.new("Real Estate Token", "RET", {
      from: account_one,
    })

    // TODO: mint multiple tokens
    await this.contract.mint(account_one, 1, { from: account_one })
    await this.contract.mint(account_two, 2, { from: account_one })
    await this.contract.mint(account_three, 3, { from: account_one })
  })

  describe("match erc721 spec", function () {
    it("should return total supply", async function () {
      const totalSupply = await this.contract.totalSupply.call()
      assert.equal(
        totalSupply.toNumber(),
        3,
        "Failed to get correct total supply"
      )
    })

    it("should get token balance", async function () {
      const balance = await this.contract.balanceOf.call(account_two, {
        from: account_two,
      })
      assert.equal(balance.toNumber(), 1, "Incorrect balance of given account")
    })

    // token uri should be complete i.e: https://s3-us-west-2.amazonaws.com/udacity-blockchain/capstone/1
    it("should return token uri", async function () {
      const originalURI =
        "https://s3-us-west-2.amazonaws.com/udacity-blockchain/capstone/1"
      const tokenURI = await this.contract.tokenURI.call(1, {
        from: account_one,
      })
      assert.equal(tokenURI, originalURI, "Failed to return original uri")
    })

    it("should transfer token from one owner to another", async function () {
      const tokenId = 1
      await this.contract.transferFrom(account_one, account_two, tokenId, {
        from: account_one,
      })

      const newOwner = await this.contract.ownerOf.call(tokenId, {
        from: account_two,
      })
      assert.equal(
        newOwner,
        account_two,
        "Failed to transfer token from one owner to another"
      )
    })
  })

  describe("have ownership properties", function () {
    it("should fail when minting when address is not contract owner", async function () {
      let fail = false
      try {
        await this.contract.mint(account_two, 3, { from: account_two })
      } catch (e) {
        fail = true
      }
      assert.equal(fail, true, "caller is not contract owner")
    })

    it("should return contract owner", async function () {
      const owner = await this.contract.owner.call({ from: account_one })
      assert.equal(owner, account_one, "owner should be account_one")
    })
  })
})
