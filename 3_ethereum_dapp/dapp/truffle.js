require("dotenv").config()

const HDWalletProvider = require("@truffle/hdwallet-provider")

const mnemonic = process.env.mnemonic
const infura_rinkeby_url = process.env.infura_rinkeby_url
const mumbai_provider = process.env.POLYGON_MUMBAI

module.exports = {
  networks: {
    develop: {
      // provider: new HDWalletProvider({
      //   mnemonic: {
      //     phrase: mnemonic,
      //   },
      //   providerOrUrl: "http://localhost:8545",
      // }),
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
    },

    mumbai: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: {
            phrase: mnemonic,
          },
          providerOrUrl: mumbai_provider,
        }),
      network_id: 80001,
    },

    rinkeby: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: {
            phrase: mnemonic,
          },
          providerOrUrl: infura_rinkeby_url,
        }),
      network_id: 4,
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
}
