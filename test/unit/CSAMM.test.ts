import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import {
  CSAMM,
  CSAMM__factory,
  Token0,
  Token0__factory,
  Token1,
  Token1__factory,
} from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import {
  ADDRESS_ZERO,
  MINTED_AMOUNT,
  SWAPPED_AMOUNT,
  developmentChains,
} from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";
import { BigNumber } from "ethers";

// ------------

describe("CSAMM", function () {
  beforeEach(async () => {
    if (!developmentChains.includes(network.name)) {
      throw new Error(
        "You need to be on a development chain to run unit tests"
      );
    }
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  type DeployFixture = {
    deployer: SignerWithAddress;
    csamm: CSAMM;
    token0: Token0;
    token1: Token1;
  };
  async function deployCSAMMFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const token0Factory: Token0__factory = await ethers.getContractFactory(
      "Token0",
      deployer
    );

    const token0: Token0 = await token0Factory.deploy();
    await token0.deployed();

    const token1Factory: Token1__factory = await ethers.getContractFactory(
      "Token0",
      deployer
    );
    const token1: Token1 = await token1Factory.deploy();
    await token1.deployed();

    const csammFactory: CSAMM__factory = await ethers.getContractFactory(
      "CSAMM",
      deployer
    );
    const csamm: CSAMM = await csammFactory.deploy(
      token0.address,
      token1.address
    );
    await csamm.deployed();
    return { deployer, csamm, token0, token1 };
  }

  // async function increaseTime(amount: number) {
  //   await ethers.provider.send("evm_increaseTime", [amount]);
  //   await ethers.provider.send("evm_mine", []);
  // }

  async function mintToken(token: Token0 | Token1, minter: SignerWithAddress) {
    await token.connect(minter).mint(MINTED_AMOUNT);
    return token;
  }

  async function approveToken(
    csamm: CSAMM,
    token: Token0 | Token1,
    signer: SignerWithAddress
  ) {
    const userBalance: BigNumber = await token.balanceOf(signer.address);
    await token.connect(signer).approve(csamm.address, userBalance);
  }

  async function addLiquidity(
    liquidityProvider: SignerWithAddress,
    token0: Token0,
    token1: Token1,
    csamm: CSAMM
  ) {
    await token0.connect(liquidityProvider).mint(MINTED_AMOUNT);
    await token0
      .connect(liquidityProvider)
      .approve(csamm.address, MINTED_AMOUNT);
    await token1.connect(liquidityProvider).mint(MINTED_AMOUNT);
    await token1
      .connect(liquidityProvider)
      .approve(csamm.address, MINTED_AMOUNT);

    await csamm
      .connect(liquidityProvider)
      .addLiquidity(MINTED_AMOUNT, MINTED_AMOUNT);
  }

  async function logPoolInfo(csamm: CSAMM) {
    const reserve0: BigNumber = await csamm.getReserve0();
    const reserve1: BigNumber = await csamm.getReserve1();
    const totalSupply: BigNumber = await csamm.getTotalSupply();

    console.log(`Reserve0: ${ethers.utils.formatUnits(reserve0)} CS0`);
    console.log(`Reserve1: ${ethers.utils.formatUnits(reserve1)} CS1`);
    console.log(`TotalSupply: ${ethers.utils.formatUnits(totalSupply)}`);
  }

  function takeFees(amount: BigNumber) {
    return amount.mul(995).div(1000);
  }

  describe("Constructor", function () {
    it("should initialize the first token address successfully", async function () {
      const { csamm, token0 } = await loadFixture(deployCSAMMFixture);

      const token0Address = await csamm.getToken0Address();

      assert.equal(token0Address, token0.address);
    });

    it("should initialize the second token address successfully", async function () {
      const { csamm, token1 } = await loadFixture(deployCSAMMFixture);

      const token1Address = await csamm.getToken1Address();

      assert.equal(token1Address, token1.address);
    });
  });

  describe("#addLiquidity", function () {
    it("should emit `LiquidityAdded` event on successful adding liquidity", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await mintToken(token0, deployer);
      await mintToken(token1, deployer);

      await approveToken(csamm, token0, deployer);
      await approveToken(csamm, token1, deployer);

      await expect(csamm.addLiquidity(MINTED_AMOUNT, MINTED_AMOUNT))
        .to.emit(csamm, "LiquidityAdded")
        .withArgs(deployer.address, MINTED_AMOUNT, MINTED_AMOUNT);
    });

    it("should transfer tokens from the `provider` to out `contract`", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await mintToken(token0, deployer);
      await mintToken(token1, deployer);

      await approveToken(csamm, token0, deployer);
      await approveToken(csamm, token1, deployer);

      await csamm.addLiquidity(MINTED_AMOUNT, MINTED_AMOUNT);

      const csammToken0Balance: BigNumber = await token0.balanceOf(
        csamm.address
      );
      const csammToken1Balance: BigNumber = await token1.balanceOf(
        csamm.address
      );

      assert.equal(csammToken0Balance.toString(), MINTED_AMOUNT.toString());
      assert.equal(csammToken1Balance.toString(), MINTED_AMOUNT.toString());
    });

    it("mint new tokens to the `provider` into our contract", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await mintToken(token0, deployer);
      await mintToken(token1, deployer);

      await approveToken(csamm, token0, deployer);
      await approveToken(csamm, token1, deployer);

      await csamm.addLiquidity(MINTED_AMOUNT, MINTED_AMOUNT);

      const providerBalance: BigNumber = await csamm.balanceOf(
        deployer.address
      );

      // Provider balance should be 200 as he added `100` to the first pairt and `100` to the second pair
      // NOTEL tokens are traded in 1 : 1 ration

      assert.equal(
        providerBalance.toString(),
        MINTED_AMOUNT.add(MINTED_AMOUNT).toString()
      );
    });

    it("update `reserve0` and `reserve1` values", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await mintToken(token0, deployer);
      await mintToken(token1, deployer);

      await approveToken(csamm, token0, deployer);
      await approveToken(csamm, token1, deployer);

      await csamm.addLiquidity(MINTED_AMOUNT, MINTED_AMOUNT);

      const reserve0: BigNumber = await csamm.getReserve0();
      const reserve1: BigNumber = await csamm.getReserve1();

      assert.equal(reserve0.toString(), MINTED_AMOUNT.toString());
      assert.equal(reserve1.toString(), MINTED_AMOUNT.toString());
    });

    it("should increases the `totalSupply` of the contract", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await mintToken(token0, deployer);
      await mintToken(token1, deployer);

      await approveToken(csamm, token0, deployer);
      await approveToken(csamm, token1, deployer);

      await csamm.addLiquidity(MINTED_AMOUNT, MINTED_AMOUNT);

      const totalSupply: BigNumber = await csamm.getTotalSupply();

      assert.equal(
        totalSupply.toString(),
        MINTED_AMOUNT.add(MINTED_AMOUNT).toString()
      );
    });

    it("reverts it the amount of shares is equal to `zero`", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await mintToken(token0, deployer);
      await mintToken(token1, deployer);

      await approveToken(csamm, token0, deployer);
      await approveToken(csamm, token1, deployer);

      await expect(csamm.addLiquidity(0, 0))
        .to.be.revertedWithCustomError(csamm, "CSAMM__SharesEqualZero")
        .withArgs(0);
    });

    it("should make `shares` differes from the the amount added if there is a `pool` already and some swaps occuars", async function () {
      const [, swapper, provider2]: SignerWithAddress[] =
        await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token0, swapper);
      await approveToken(csamm, token0, swapper);

      await csamm.connect(swapper).swap(token0.address, SWAPPED_AMOUNT);

      await addLiquidity(provider2, token0, token1, csamm);

      const provider2Shares: BigNumber = await csamm.balanceOf(
        provider2.address
      );

      /*
        - We added liquidity by 100 : 100
        - res0 -> 100, res1 -> 100
        - totalSupply -> 200
        - then made a swap of 10 tokens
        - res0 -> 110 , res1 -> 90.05 (since there is 0.5% fees)
        - totalSupply doesn't changed (200)
        - When adding amother liquidity, the amount of shares will be:
          ((amount0, amount1) * totalSupply) / (res0 + res1) = 
          ((100 + 100) * 200) / (110 + 90.05) = 
          (200 * 200) / 200.05 = 
          200 * (4000 / 4001)

          Which means that the number of shares will be less than the amount the provider added by the ration 4000 : 4001
      */

      const amountAdded: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT); // 100 token to each pair

      assert.equal(
        provider2Shares.toString(),
        amountAdded.mul(4000).div(4001).toString()
      );
    });
  });

  describe("#swap", function () {
    it("should emit `Swapped` event on successful swapping", async function () {
      const [, swapper]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token0, swapper);
      await approveToken(csamm, token0, swapper);

      await expect(csamm.connect(swapper).swap(token0.address, SWAPPED_AMOUNT))
        .to.emit(csamm, "Swapped")
        .withArgs(
          swapper.address,
          token0.address,
          SWAPPED_AMOUNT,
          token1.address,
          takeFees(SWAPPED_AMOUNT)
        );
    });

    it("should increase pool `tokenIn` balance and decrease amount of `tokenOut`", async function () {
      const [, swapper]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token0, swapper);
      await approveToken(csamm, token0, swapper);

      await csamm.connect(swapper).swap(token0.address, SWAPPED_AMOUNT);

      const poolToken0Balance: BigNumber = await token0.balanceOf(
        csamm.address
      );
      const poolToken1Balance: BigNumber = await token1.balanceOf(
        csamm.address
      );

      assert.equal(
        poolToken0Balance.toString(),
        MINTED_AMOUNT.add(SWAPPED_AMOUNT).toString()
      );
      assert.equal(
        poolToken1Balance.toString(),
        MINTED_AMOUNT.sub(takeFees(SWAPPED_AMOUNT)).toString()
      );
    });

    it("should increase `reserve0` and `reserve1` correctly", async function () {
      const [, swapper]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token0, swapper);
      await approveToken(csamm, token0, swapper);

      await csamm.connect(swapper).swap(token0.address, SWAPPED_AMOUNT);

      const poolRes0Balance: BigNumber = await csamm.getReserve0();
      const poolRes1Balance: BigNumber = await csamm.getReserve1();

      assert.equal(
        poolRes0Balance.toString(),
        MINTED_AMOUNT.add(SWAPPED_AMOUNT).toString()
      );
      assert.equal(
        poolRes1Balance.toString(),
        MINTED_AMOUNT.sub(takeFees(SWAPPED_AMOUNT)).toString()
      );
    });

    it("should transfer tokens to the `swapper` - platform fees", async function () {
      const [, swapper]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token0, swapper);
      await approveToken(csamm, token0, swapper);

      await csamm.connect(swapper).swap(token0.address, SWAPPED_AMOUNT);

      const swapperToken0Balance: BigNumber = await token0.balanceOf(
        swapper.address
      );
      const swapperToken1Balance: BigNumber = await token1.balanceOf(
        swapper.address
      );

      assert.equal(
        swapperToken0Balance.toString(),
        MINTED_AMOUNT.sub(SWAPPED_AMOUNT).toString()
      );
      assert.equal(
        swapperToken1Balance.toString(),
        takeFees(SWAPPED_AMOUNT).toString()
      );
    });

    it("should made the same functionality if the swapped token is the other pair", async function () {
      const [, swapper]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token1, swapper);
      await approveToken(csamm, token1, swapper);

      await expect(csamm.connect(swapper).swap(token1.address, SWAPPED_AMOUNT))
        .to.emit(csamm, "Swapped")
        .withArgs(
          swapper.address,
          token1.address,
          SWAPPED_AMOUNT,
          token0.address,
          takeFees(SWAPPED_AMOUNT)
        );
    });

    it("should change the exchange of the pair if the reserve ration is not 1: 1", async function () {
      const [, swapper, swapper2]: SignerWithAddress[] =
        await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token0, swapper);
      await approveToken(csamm, token0, swapper);

      await csamm.connect(swapper).swap(token0.address, SWAPPED_AMOUNT);

      // Ratio changed and not becomes 1 : 1 it became 11 : 9

      await mintToken(token0, swapper2);
      await approveToken(csamm, token0, swapper2);

      await csamm.connect(swapper2).swap(token0.address, SWAPPED_AMOUNT);

      const swapper2Token1Balance: BigNumber = await token1.balanceOf(
        swapper2.address
      );

      // - taking fees from the input
      // - and multiply it by 110 (reserve input)
      // - then divide it by 90.05 (reserve out, remember we took fees from the first TX)
      const number9to11WithFees: BigNumber = takeFees(SWAPPED_AMOUNT)
        .mul(9005)
        .div(11000);

      console.log(swapper2Token1Balance);

      assert.equal(
        swapper2Token1Balance.toString(),
        number9to11WithFees.toString()
      );
    });

    it("reverts if the swappedToken address is not valid", async function () {
      const [, swapper]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      await mintToken(token0, swapper);
      await approveToken(csamm, token0, swapper);

      const invalidTokenAddress: string = ADDRESS_ZERO;

      await expect(
        csamm.connect(swapper).swap(invalidTokenAddress, SWAPPED_AMOUNT)
      )
        .to.be.revertedWithCustomError(csamm, "CSAMM__InvalidToken")
        .withArgs(invalidTokenAddress);
    });
  });

  describe("#removeLiquidity", function () {
    it("should emit `LiquidityRemoved` event on successful removing liquidity", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      // we will remove all tokens from the pool
      const removedShares: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT);

      await expect(csamm.removeLiquidity(removedShares))
        .to.emit(csamm, "LiquidityRemoved")
        .withArgs(deployer.address, MINTED_AMOUNT, MINTED_AMOUNT);
    });

    it("should remove decrease the `totalSupply` of teh contract", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      // we will remove all tokens from the pool
      const removedShares: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT);

      await csamm.removeLiquidity(removedShares);

      const totalSupply: BigNumber = await csamm.getTotalSupply();

      assert.equal(totalSupply.toString(), "0");
    });

    it("should remove the balance from the provider", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      // we will remove all tokens from the pool
      const removedShares: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT);

      await csamm.removeLiquidity(removedShares);

      const providerBalance: BigNumber = await csamm.balanceOf(
        deployer.address
      );

      assert.equal(providerBalance.toString(), "0");
    });

    it("should decrease `reserve0` and `reserve1`", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      // we will remove all tokens from the pool
      const removedShares: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT);

      await csamm.removeLiquidity(removedShares);

      const reserve0: BigNumber = await csamm.getReserve0();
      const reserve1: BigNumber = await csamm.getReserve1();

      assert.equal(reserve0.toString(), "0");
      assert.equal(reserve1.toString(), "0");
    });

    it("should transfer tokens to the provider address", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      await addLiquidity(deployer, token0, token1, csamm);

      const providerToken0BalanceBeforeRemovingLiquidity: BigNumber =
        await token0.balanceOf(deployer.address);
      const providerToken1BalanceBeforeRemovingLiquidity: BigNumber =
        await token1.balanceOf(deployer.address);

      // we will remove all tokens from the pool
      const removedShares: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT);

      await csamm.removeLiquidity(removedShares);

      const providerToken0BalanceAfterRemovingLiquidity: BigNumber =
        await token0.balanceOf(deployer.address);
      const providerToken1BalanceAfterRemovingLiquidity: BigNumber =
        await token1.balanceOf(deployer.address);

      assert.equal(
        providerToken0BalanceAfterRemovingLiquidity.toString(),
        providerToken0BalanceBeforeRemovingLiquidity
          .add(MINTED_AMOUNT)
          .toString()
      );
      assert.equal(
        providerToken1BalanceAfterRemovingLiquidity.toString(),
        providerToken1BalanceBeforeRemovingLiquidity
          .add(MINTED_AMOUNT)
          .toString()
      );
    });

    it("reverts if there is no shares to remove", async function () {
      const { deployer, csamm, token0, token1 } = await loadFixture(
        deployCSAMMFixture
      );

      // we will remove all tokens from the pool
      const removedShares: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT);

      await expect(csamm.removeLiquidity(removedShares))
        .to.be.revertedWithCustomError(csamm, "CSAMM__SharesEqualZero")
        .withArgs(0);
    });
  });
});
