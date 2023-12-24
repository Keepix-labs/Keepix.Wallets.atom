import {
  AccountData,
  DirectSecp256k1HdWallet,
  DirectSecp256k1Wallet,
  makeCosmoshubPath,
} from '@cosmjs/proto-signing'
import { Bip39, EnglishMnemonic, Slip10, Slip10Curve } from '@cosmjs/crypto'
import {
  GasPrice,
  MsgSendEncodeObject,
  QueryClient,
  SigningStargateClient,
  calculateFee,
  createProtobufRpcClient,
} from '@cosmjs/stargate'
import { QueryClientImpl as IBCQueryClientImpl } from 'cosmjs-types/ibc/applications/transfer/v1/query'
import {QueryClientImpl as BankQueryClientImpl} from 'cosmjs-types/cosmos/bank/v1beta1/query'
import { Tendermint34Client } from '@cosmjs/tendermint-rpc'

function createPrivateKey(templatePrivateKey: string, password: string) {
  const crypto = require('crypto')

  const hash = crypto
    .createHash('sha256')
    .update(templatePrivateKey + password, 'utf8')
    .digest('hex')
  return hash.substring(0, 64) // Truncate to 64 characters (32 bytes)
}

function formatUnits(value: any, decimals: number) {
  let display = value.toString()

  const negative = display.startsWith('-')
  if (negative) display = display.slice(1)

  display = display.padStart(decimals, '0')

  let [integer, fraction] = [
    display.slice(0, display.length - decimals),
    display.slice(display.length - decimals),
  ]
  fraction = fraction.replace(/(0+)$/, '')
  return `${negative ? '-' : ''}${integer || '0'}${
    fraction ? `.${fraction}` : ''
  }`
}

function parseUnits(value: string, decimals: number) {
  let [integer, fraction = '0'] = value.split('.')

  const negative = integer.startsWith('-')
  if (negative) integer = integer.slice(1)

  // trim leading zeros.
  fraction = fraction.replace(/(0+)$/, '')

  // round off if the fraction is larger than the number of decimals.
  if (decimals === 0) {
    if (Math.round(Number(`.${fraction}`)) === 1)
      integer = `${BigInt(integer) + 1n}`
    fraction = ''
  } else if (fraction.length > decimals) {
    const [left, unit, right] = [
      fraction.slice(0, decimals - 1),
      fraction.slice(decimals - 1, decimals),
      fraction.slice(decimals),
    ]

    const rounded = Math.round(Number(`${unit}.${right}`))
    if (rounded > 9)
      fraction = `${BigInt(left) + BigInt(1)}0`.padStart(left.length + 1, '0')
    else fraction = `${left}${rounded}`

    if (fraction.length > decimals) {
      fraction = fraction.slice(1)
      integer = `${BigInt(integer) + 1n}`
    }

    fraction = fraction.slice(0, decimals)
  } else {
    fraction = fraction.padEnd(decimals, '0')
  }

  return `${negative ? '-' : ''}${integer}${fraction}`
}

/**
 * Wallet class who respect the WalletLibraryInterface for Keepix
 */
export class Wallet {
  private wallet?: DirectSecp256k1HdWallet | DirectSecp256k1Wallet
  private mnemonic?: string
  private type?: string
  private keepixTokens?: { coins: any; tokens: any }
  private rpc?: any
  private privateKey?: string
  private account?: AccountData
  private client?: SigningStargateClient

  constructor() {}

  public async init({
    password,
    mnemonic,
    privateKey,
    type,
    keepixTokens,
    rpc,
    privateKeyTemplate = '0x2050939757b6d498bb0407e001f0cb6db05c991b3c6f7d8e362f9d27c70128b9',
  }: {
    password?: string
    mnemonic?: string
    privateKey?: string
    type: string
    keepixTokens?: { coins: any; tokens: any } // whitelisted coins & tokens
    rpc: string
    privateKeyTemplate?: string
  }) {
    this.type = type
    this.keepixTokens = keepixTokens
    this.rpc = rpc
    // from password
    if (password !== undefined) {
      const newEntory = createPrivateKey(privateKeyTemplate, password)
      this.mnemonic = Bip39.encode(Buffer.from(newEntory, 'hex')).toString()
      this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic)
      this.privateKey = await this.getPrivateKeyFromMnemonic(this.mnemonic)

      const [account] = await this.wallet.getAccounts()
      this.account = account

      this.client = await SigningStargateClient.connectWithSigner(
        rpc,
        this.wallet,
      )
      return
    }
    // from mnemonic
    if (mnemonic !== undefined) {
      this.mnemonic = mnemonic
      this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic)
      this.privateKey = await this.getPrivateKeyFromMnemonic(this.mnemonic)

      const [account] = await this.wallet.getAccounts()
      this.account = account

      this.client = await SigningStargateClient.connectWithSigner(
        rpc,
        this.wallet,
      )
      return
    }
    // from privateKey only
    if (privateKey !== undefined) {
      this.mnemonic = undefined
      this.privateKey = privateKey
      this.wallet = await DirectSecp256k1Wallet.fromKey(
        Buffer.from(privateKey.replaceAll('0x', ''), 'hex'),
      )

      const [account] = await this.wallet.getAccounts()
      this.account = account

      this.client = await SigningStargateClient.connectWithSigner(
        rpc,
        this.wallet,
      )

      return
    }

    // Random
    this.wallet = await DirectSecp256k1HdWallet.generate(24)
    this.mnemonic = this.wallet.mnemonic
    this.privateKey = await this.getPrivateKeyFromMnemonic(this.mnemonic)

    const [account] = await this.wallet.getAccounts()
    this.account = account

    this.client = await SigningStargateClient.connectWithSigner(
      rpc,
      this.wallet,
    )
  }

  // // PUBLIC

  public getPrivateKey() {
    return this.privateKey
  }

  public getMnemonic() {
    return this.mnemonic
  }

  public getAddress() {
    return this.account?.address
  }

  public async getProdiver() {
    return await SigningStargateClient.connect(this.rpc)
  }

  public getConnectedWallet = async () => {
    return this.client
  }

  public async getTokenInformation(tokenAddress: string) {
    if (!this.client || !this.account) throw new Error('Not initialized')
    try {
      const tendermint = await Tendermint34Client.connect(this.rpc)
      const queryClient = new QueryClient(tendermint)
      const rpcClient = createProtobufRpcClient(queryClient)
      const ibcClient = new IBCQueryClientImpl(rpcClient)
      const denomInfo = await ibcClient.DenomTrace({hash: tokenAddress.slice(4)})
      if(!denomInfo.denomTrace) return undefined
      const bankClient = new BankQueryClientImpl(rpcClient)
      const metadata = (await bankClient.DenomMetadata({denom: denomInfo.denomTrace.baseDenom}))
      return {
        name: metadata.metadata.name,
        symbol: metadata.metadata.symbol,
        decimals: 0
      }
    } catch (err) {
      console.log(err)
      return undefined
    }
  }

  // always display the balance in 0 decimals like 1.01 ATOM
  public async getCoinBalance(walletAddress?: string) {
    if (!this.client || !this.account) throw new Error('Not initialized')

    try {
      const balance = await this.client.getBalance(
        walletAddress ?? this.account.address,
        'uatom',
      )
      return formatUnits(balance.amount, 6)
    } catch (err) {
      console.log(err)
      return '0'
    }
  }

  // always display the balance in 0 decimals like 1.01 RPL
  public async getTokenBalance(tokenAddress: string, walletAddress?: string) {
    if (!this.client || !this.account) throw new Error('Not initialized')

    try {
      console.log(await this.getTokenInformation(tokenAddress))
      const balance = await this.client.getBalance(
        walletAddress ?? this.account.address,
        tokenAddress,
      )

      return formatUnits(balance.amount, 6)
    } catch (err) {
      console.log(err)
      return '0'
    }
  }

  public async estimateCostOfTx(tx: any) {
    if (!this.client || !this.account) throw new Error('Not initialized')
    try {
      const estimation = await this.client.simulate(
        this.account.address,
        [tx],
        undefined,
      )
      return { success: true, description: estimation.toString() }
    } catch (err) {
      console.log(err)
      return { success: false, description: `Estimation failed: ${err}` }
    }
  }

  public async estimateCostSendCoinTo(receiverAddress: string, amount: string) {
    const sendMsg: MsgSendEncodeObject = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: {
        fromAddress: this.account?.address,
        toAddress: receiverAddress,
        amount: [{ denom: 'uatom', amount: parseUnits(amount, 6) }],
      },
    }
    return await this.estimateCostOfTx(sendMsg)
  }

  public async sendCoinTo(receiverAddress: string, amount: string) {
    if (!this.client || !this.account) throw new Error('Not initialized')
    try {
      const defaultGas = calculateFee(100000, GasPrice.fromString('0.025uatom'))

      const tx = await this.client.sendTokens(
        this.account.address,
        receiverAddress,
        [{ denom: 'uatom', amount: parseUnits(amount, 6) }],
        defaultGas,
      )

      if (!!tx.code) {
        return {
          success: false,
          description: `Transaction failed: ${tx.rawLog}`,
        }
      } else {
        return { success: true, description: tx.transactionHash }
      }
    } catch (err) {
      console.log(err)
      return { success: false, description: `Transaction failed: ${err}` }
    }
  }

  public async sendTokenTo(
    tokenAddress: string,
    receiverAddress: string,
    amount: string,
  ) {
    if (!this.client || !this.account) throw new Error('Not initialized')
    try {
      const defaultGas = calculateFee(100000, GasPrice.fromString('0.025uatom'))

      const tx = await this.client.sendTokens(
        this.account.address,
        receiverAddress,
        [{ denom: tokenAddress, amount: parseUnits(amount, 6) }],
        defaultGas,
      )

      if (!!tx.code) {
        return {
          success: false,
          description: `Transaction failed: ${tx.rawLog}`,
        }
      } else {
        return { success: true, description: tx.transactionHash }
      }
    } catch (err) {
      console.log(err)
      return { success: false, description: `Transaction failed: ${err}` }
    }
  }

  public async estimateCostSendTokenTo(
    tokenAddress: string,
    receiverAddress: string,
    amount: string,
  ) {
    const sendMsg: MsgSendEncodeObject = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: {
        fromAddress: this.account?.address,
        toAddress: receiverAddress,
        amount: [{ denom: tokenAddress, amount: parseUnits(amount, 6) }],
      },
    }
    return await this.estimateCostOfTx(sendMsg)
  }

  private async getPrivateKeyFromMnemonic(mnemonic: string) {
    const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic))
    const { privkey } = Slip10.derivePath(
      Slip10Curve.Secp256k1,
      seed,
      makeCosmoshubPath(0),
    )
    return `0x${Buffer.from(privkey).toString('hex')}`
  }
}
