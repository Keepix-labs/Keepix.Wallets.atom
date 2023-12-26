import { Wallet } from './Wallet'

describe('basic wallet', () => {
  const mnemonic =
    'celery net original hire stand seminar cricket reject draft hundred hybrid dry three chair sea enable perfect this good race tooth junior beyond since'
  const privateKey =
    '0xbb50fde263e3626e39198e1a65d48ccfe76406dcea7ba21f7cc7e685cd879f3a'
  const address = 'cosmos1wk79ldxl6k5hweg33zuacuw7hc29mp658etctk'

  it('can generate same wallet', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      password: 'toto',
    })

    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toEqual(mnemonic)
  })

  it('can generate with Mnemonic', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      mnemonic,
    })

    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toEqual(mnemonic)
  })

  it('can generate with PrivateKey', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      privateKey,
    })

    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toBeUndefined()
  })

  it('can generate with random', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
    })

    expect(wallet.getAddress()).toBeDefined()
    expect(wallet.getPrivateKey()).toBeDefined()
    expect(wallet.getMnemonic()).toBeDefined()
  })

  it('can getBalance', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      mnemonic,
    })

    expect(
      await wallet.getCoinBalance(
        'cosmos19p93d2j6r9knqj358xsjczes49tx4yxj454jp9',
      ),
    ).toEqual('877449.35397')
  })

  it('can getTokenInformation', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      mnemonic,
    })

    expect(
      await wallet.getTokenInformation(
        'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013',
      ),
    ).toEqual({
      name: 'uusdc',
      symbol: 'uusdc',
      decimals: 6,
    })
  })

  it('can getTokenBalance', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      mnemonic,
    })

    expect(
      await wallet.getTokenBalance(
        'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013',
        'cosmos1r0t2zplulmfnuhx3de6wu4njg69yct0wv9383z',
      ),
    ).toEqual('3160000')
  })

  it('can estimate sendCoin', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      mnemonic,
    })

    const estimationResult = await wallet.estimateCostSendCoinTo(
      'cosmos1qvrdygnwqt4zm9cyfqzy34d6mhslxahq4dsfyf',
      '0.001',
    )
    expect(estimationResult.success).toBe(true)
    // expect(estimationResult.description).toMatch('insufficient funds')
  })

  it('can estimate sendToken', async () => {
    const wallet = new Wallet()
    await wallet.init({
      type: 'atom',
      rpc: { url: 'https://cosmos-rpc.publicnode.com:443' },
      mnemonic,
    })

    const estimationResult = await wallet.estimateCostSendTokenTo(
      'ibc/2154552F1CE0EF16FAC73B41A837A7D91DD9D2B6E193B53BE5C15AB78E1CFF40',
      'cosmos1p3ucd3ptpw902fluyjzhq3ffgq4ntddac9sa3s',
      '1',
    )
    expect(estimationResult.success).toBe(false)
    // expect(estimationResult.description).toMatch(
    //   'execution reverted: ERC20: transfer amount exceeds balance',
    // )
  })
})
