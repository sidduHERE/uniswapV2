import { expect } from "chai";
import { ethers } from "hardhat";
import { Token, UniswapV2Router02, UniswapV2Pair } from "../typechain";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("uniswap v2 core Part 1", function () {
  let admin;
  let tokenFactory;
  let pairFactory;
  let swapRouter: UniswapV2Router02;
  let signers: SignerWithAddress[]
  let tokenA: Token
  let tokenB: Token
  let pair: UniswapV2Pair
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let token0Price: BigNumber;
  let token1Price: BigNumber;

  this.beforeEach(async () => {

    signers = await ethers.getSigners();
    admin = signers[0];
    tokenFactory = await ethers.getContractFactory("Token", admin);
    user1 = signers[1];
    user2 = signers[2];

    //Create tokens and pool for tokens
    tokenA = await tokenFactory.deploy("Dollar", "USD");
    tokenB = await tokenFactory.deploy("Ether", "WETH");
    pairFactory = await (await ethers.getContractFactory("UniswapV2Factory")).deploy(admin.address);
    swapRouter = await (await ethers.getContractFactory("UniswapV2Router02")).deploy(pairFactory.address, tokenB.address);

    await pairFactory.createPair(tokenA.address, tokenB.address);
    const pairAddress = await pairFactory.getPair(tokenA.address, tokenB.address);
    pair = await ethers.getContractAt("UniswapV2Pair", pairAddress, admin);
    token0Price = BigNumber.from(1);
    token1Price = BigNumber.from(10);

    tokenA.connect(admin).transfer(signers[1].address, ethers.utils.parseUnits("20000"));
    tokenB.connect(admin).transfer(signers[1].address, ethers.utils.parseUnits("200"));

    tokenA.connect(admin).transfer(signers[2].address, ethers.utils.parseUnits("20000"));
    tokenB.connect(admin).transfer(signers[2].address, ethers.utils.parseUnits("200"));
  });

  it("4.3 Preserve Token Supply", async function () {
    const beforeSupplyTokenA = await tokenA.totalSupply()
    const beforeSupplyTokenB = await tokenB.totalSupply()
    let amount = ethers.utils.parseUnits("20")
    await tokenA.connect(user1).approve(swapRouter.address, amount);
    await tokenB.connect(user1).approve(swapRouter.address, amount);
    await tokenB.connect(user2).approve(swapRouter.address, amount);
    await tokenA.connect(user2).approve(swapRouter.address, amount);
    await swapRouter.connect(user1).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user1.address, 2000000000)
    await swapRouter.connect(user2).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user2.address, 2000000000)

    // expecting same supply when supplied liquidity 
    expect(await tokenA.totalSupply()).to.equal(beforeSupplyTokenA)
    expect(await tokenB.totalSupply()).to.equal(beforeSupplyTokenB)

    // swap
    await tokenA.connect(user1).approve(swapRouter.address, amount);
    await swapRouter.connect(user1).swapExactTokensForTokens(
      amount,
      0,
      [tokenA.address, tokenB.address],
      user1.address,
      2000000000
    );

    // expecting same supply when swapped in liquidity 
    expect(await tokenA.totalSupply()).to.equal(beforeSupplyTokenA)
    expect(await tokenB.totalSupply()).to.equal(beforeSupplyTokenB)

    //remove liquidity
    let balance = await pair.balanceOf(user1.address);
    await pair.connect(user1).approve(swapRouter.address, balance);
    
    await swapRouter.connect(user1).removeLiquidity(
        tokenA.address,
        tokenB.address,
        balance,
        0,
        0,
        user1.address,
        2000000000
    );

    // expecting same supply when removed liquidity 
    expect(await tokenA.totalSupply()).to.equal(beforeSupplyTokenA)
    expect(await tokenB.totalSupply()).to.equal(beforeSupplyTokenB)
    // const Greeter = await ethers.getContractFactory("Greeter");
    // const greeter = await Greeter.deploy("Hello, world!");
    // await greeter.deployed();

    // expect(await greeter.greet()).to.equal("Hello, world!");

    // const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // // wait until the transaction is mined
    // await setGreetingTx.wait();

    // expect(await greeter.greet()).to.equal("Hola, mundo!");
  });

  it("4.4 Preserve reserve ratio", async function () {
    let reserveRatioBefore;

    // add liquidity
    let amount = ethers.utils.parseUnits("20")
    await tokenA.connect(user1).approve(swapRouter.address, amount);
    await tokenB.connect(user1).approve(swapRouter.address, amount);
    await tokenB.connect(user2).approve(swapRouter.address, amount);
    await tokenA.connect(user2).approve(swapRouter.address, amount);
    await swapRouter.connect(user1).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user1.address, 2000000000)
    reserveRatioBefore = await (await reserveRatio()).reserveRatio

    // expecting same supply when supplied liquidity 
    await swapRouter.connect(user2).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user2.address, 2000000000)
    expect((await reserveRatio()).reserveRatio).to.equal(reserveRatioBefore)

    //remove liquidity
    let balance = await pair.balanceOf(user1.address);
    await pair.connect(user1).approve(swapRouter.address, balance);
    
    await swapRouter.connect(user1).removeLiquidity(
        tokenA.address,
        tokenB.address,
        balance,
        0,
        0,
        user1.address,
        2000000000
    );

    // expecting same reserveRatio when removed liquidity 
    expect((await reserveRatio()).reserveRatio).to.equal(reserveRatioBefore)

  });

  it("4.5 Preserve redeem ratio", async function () {
    let redeemRatioBefore;

    // add liquidity
    let amount = ethers.utils.parseUnits("20")
    await tokenA.connect(user1).approve(swapRouter.address, amount);
    await tokenB.connect(user1).approve(swapRouter.address, amount);
    await tokenB.connect(user2).approve(swapRouter.address, amount);
    await tokenA.connect(user2).approve(swapRouter.address, amount);
    await swapRouter.connect(user1).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user1.address, 2000000000)
    redeemRatioBefore = await (await redeemRatio()).redeemRatio

    // expecting same supply when supplied liquidity 
    await swapRouter.connect(user2).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user2.address, 2000000000)
    expect((await redeemRatio()).redeemRatio).to.equal(redeemRatioBefore)

    //remove liquidity
    let balance = await pair.balanceOf(user1.address);
    await pair.connect(user1).approve(swapRouter.address, balance);
    
    await swapRouter.connect(user1).removeLiquidity(
        tokenA.address,
        tokenB.address,
        balance,
        0,
        0,
        user1.address,
        2000000000
    );

    // expecting same reserveRatio when removed liquidity 
    expect((await redeemRatio()).redeemRatio).to.equal(redeemRatioBefore)
  });

  it("4.6 Preserve reserve net worth", async function () {
    let amount = ethers.utils.parseUnits("20")
    await tokenA.connect(user1).approve(swapRouter.address, amount.add(amount));
    await tokenB.connect(user1).approve(swapRouter.address, amount.add(amount));
    await tokenB.connect(user2).approve(swapRouter.address, amount);
    await tokenA.connect(user2).approve(swapRouter.address, amount);
    await swapRouter.connect(user1).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user1.address, 2000000000)
    // calculating total worth
    let bal11, bal12, bal3, bal11Worth, bal12Worth
     bal11 = await tokenA.balanceOf(user1.address);
     bal12 = await tokenB.balanceOf(user1.address);
     bal3 = await pair.balanceOf(user1.address);

    let totalSupply = await pair.totalSupply();

    let lpWorth = BigNumber.from(0), totalWorth;

     bal11Worth = bal11.mul(token0Price);
     bal12Worth = bal12.mul(token1Price);
    totalWorth  = bal11Worth.add(bal12Worth);

    if(!totalSupply.eq(BigNumber.from(0))) {
     let token0Share = bal3.mul(await reserves(false)).div(totalSupply)
     let token1Share = bal3.mul(await reserves(true)).div(totalSupply)
        lpWorth = token0Share.mul(token0Price).add(token1Share.mul(token1Price));
        totalWorth = totalWorth.add(lpWorth);
    }

    //storing it in prev Worth
    let prevWorth = totalWorth;

    //adding more liquidity to calculate the latest total worth
    await swapRouter.connect(user1).addLiquidity(tokenA.address, tokenB.address, amount, amount, amount, amount, user1.address, 2000000000)
    bal11 = await tokenA.balanceOf(user1.address);
    bal12 = await tokenB.balanceOf(user1.address);
    bal3 = await pair.balanceOf(user1.address);

    totalSupply = await pair.totalSupply();

    bal11Worth = bal11.mul(token0Price);
    bal12Worth = bal12.mul(token1Price);
    totalWorth  = bal11Worth.add(bal12Worth);

    if(!totalSupply.eq(BigNumber.from(0))) {
      let token0Share = bal3.mul(await reserves(false)).div(totalSupply)
      let token1Share = bal3.mul(await reserves(true)).div(totalSupply)
        lpWorth = token0Share.mul(token0Price).add(token1Share.mul(token1Price));
        totalWorth = totalWorth.add(lpWorth);
    }

    expect(totalWorth).to.eq(prevWorth)

  });

  async function reserveRatio()  {
    const {_reserve0, _reserve1 } = await pair.getReserves();
    if(_reserve1.eq(0) || _reserve0.eq(0)) return  {
        ratio:BigNumber.from(0)
    }
    return {
      reserveRatio: _reserve0.div(_reserve1),
    }
  }

  async function reserves(b:boolean)  {
    const {_reserve0, _reserve1 } = await pair.getReserves();
   if(b) return _reserve0;
   else return _reserve1;
  }

  async function redeemRatio()  {
    const {_reserve0, _reserve1 } = await pair.getReserves();
    const totalSupply = await pair.totalSupply();
    if(totalSupply.eq(0)) return  {
        ratio:totalSupply
    }
    return {
      redeemRatio: Math.min((_reserve0.div(totalSupply)).toNumber(), (_reserve1.div(totalSupply)).toNumber()),
    }
}

});



