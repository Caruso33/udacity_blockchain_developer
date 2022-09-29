/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require("crypto-js/sha256")
const BlockClass = require("./block.js")
const bitcoinMessage = require("bitcoinjs-message")

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = []
    this.height = -1
    this.initializeChain()
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      const block = new BlockClass.Block({ data: "Genesis Block" })

      await this._addBlock(block)
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    return new Promise((resolve, _reject) => {
      resolve(this.height)
    })
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  _addBlock(block) {
    const self = this

    return new Promise(async (resolve, reject) => {
      block.time = new Date().getTime().toString().slice(0, -3)

      // genesis block otherwise assign hash
      block.previousBlockHash =
        self.height == -1 ? null : self.chain[self.height].hash

      self.height += 1
      block.height = self.height

      block.hash = SHA256(JSON.stringify(block)).toString()

      self.chain.push(block)

      const errorLog = await self.validateChain()
      if (errorLog.length > 0) {
        self.chain.pop()
        return reject(errorLog)
      }

      console.log("blockchain.js _addBlock: ", block)

      resolve(block)
    })
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    return new Promise((resolve, _reject) => {
      const message = `${address}:${new Date()
        .getTime()
        .toString()
        .slice(0, -3)}:starRegistry`

      console.log(`blockchain.js requestMessageOwnership: ${message}`)

      resolve(message)
    })
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  submitStar(address, message, signature, star) {
    const self = this

    return new Promise(async (resolve, reject) => {
      const messageTime = parseInt(message.split(":")[1])
      const currentTime = parseInt(new Date().getTime().toString().slice(0, -3))

      if (currentTime - messageTime > 60 * 5) {
        return reject(
          new Error(
            `blockchain.js submitStar: more than five minutes have elapsed, ${currentTime} - ${messageTime}`
          )
        )
      }

      let isVerified = false
      try {
        isVerified = bitcoinMessage.verify(message, address, signature)
      } catch (error) {
        console.error(`blockchain.js submitStar: ${error}`)
      }

      const blockData = { address, message, signature, star }

      if (!isVerified) {
        console.log(
          `submitStar verification: ${isVerified} rejecting block ${JSON.stringify(
            blockData
          )}`
        )
        return reject(blockData)
      }

      const block = new BlockClass.Block(blockData)

      console.log(
        `submitStar verification: ${isVerified} adding block ${JSON.stringify(
          block
        )}`
      )

      await self._addBlock(block)

      resolve(block)
    })
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    const self = this

    return new Promise((resolve, _reject) => {
      const block = self.chain.find((block) => block.hash === hash)

      if (block) {
        resolve(block)
      } else {
        resolve(null)
      }
    })
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    const self = this
    return new Promise((resolve, _reject) => {
      const block = self.chain.filter((block) => block.height === height)[0]

      if (block) {
        resolve(block)
      } else {
        resolve(null)
      }
    })
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    const self = this

    const promisedStars = self.chain.map(async (block) => {
      return new Promise(async (resolve, _reject) => {
        try {
          const blockData = await block.getBData()

          console.log(
            `blockchain.js getStarsByWalletAddress blockData: ${blockData}`
          )

          if (blockData.address === address) resolve(blockData)
          else resolve(null)
        } catch (error) {
          console.error(`blockchain.js getStarsByWalletAddress: ${error}`)
          resolve(null)
        }
      })
    })

    return Promise.all(promisedStars).then((stars) => {
      return stars.filter((star) => star !== null)
    })
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check with the previousBlockHash
   */
  validateChain() {
    const self = this
    const promisedErrorLogs = self.chain.map((block) => {
      return new Promise(async (resolve, _reject) => {
        const isValid = await block.validate()

        if (!isValid) resolve(block)
        else resolve(null)
      })
    })

    return Promise.all(promisedErrorLogs).then((errorLogs) => {
      return errorLogs.filter((errorLog) => errorLog !== null)
    })
  }
}

module.exports.Blockchain = Blockchain
