// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import "hardhat/console.sol"; // used in testing purposes

/**
 * @title Constant Sum AMM  Smart contract
 * @author Al-Qa'qa'
 * @notice This contract works as a simple AMM using Constant summ (X + Y = K) Algorism
 */
contract CSAMM {
  event LiquidityAdded(
    address provider,
    uint256 token0AmountAdded,
    uint256 token1AmountAdded
  );

  event Swapped(
    address swapper,
    address tokenIn,
    uint256 amountIn,
    address tokenOut,
    uint256 amountOut
  );

  event LiquidityRemoved(
    address provider,
    uint256 token0AmountRemoved,
    uint256 token1AmountRemoved
  );

  //////////////
  /// Errors ///
  //////////////

  error CSAMM__InvalidToken(address token);
  error CSAMM__SharesEqualZero(uint256 shares);
  error CSAMM__PriceEqualZero(uint256 amount0, uint256 amount1);

  /////////////////
  /// Variables ///
  /////////////////

  IERC20 private immutable _i_token0;
  IERC20 private immutable _i_token1;

  uint256 private _reserve0;
  uint256 private _reserve1;

  uint256 private _totalSupply;

  mapping(address => uint256) public balanceOf;

  /////////////////////////////////
  /// Modifiers and Constructor ///
  /////////////////////////////////

  /**
   * @notice deploy the contract and add the two token addresses provider to be in the pool
   * @dev this AMM acts that the two pairs has ration 1 : 1 as default
   *
   * @param _token0 The first token address pair
   * @param _token1 The second token address pair
   */
  constructor(address _token0, address _token1) {
    _i_token0 = IERC20(_token0);
    _i_token1 = IERC20(_token1);
  }

  ///////////////////////////////////////////////
  //////// external and public function /////////
  ///////////////////////////////////////////////

  /**
   * @notice swap token in the pool for the other token
   * @dev token must be one of the two token addresses we definied in the constructor
   *
   * @param _tokenIn the token that will be swapped
   * @param _amountIn the amount of tokens to swap
   */
  function swap(
    address _tokenIn,
    uint256 _amountIn
  ) external returns (uint256 amountOut) {
    if (_tokenIn != getToken0Address() && _tokenIn != getToken1Address()) {
      revert CSAMM__InvalidToken(_tokenIn);
    }

    bool isToken0 = _tokenIn == getToken0Address();
    (IERC20 tokenIn, IERC20 tokenOut, uint256 resIn, uint256 resOut) = isToken0
      ? (_i_token0, _i_token1, _reserve0, _reserve1)
      : (_i_token1, _i_token0, _reserve1, _reserve0);

    // Transfer token In
    tokenIn.transferFrom(msg.sender, address(this), _amountIn);
    uint256 amountIn = tokenIn.balanceOf(address(this)) - resIn; // This should be equal to `_amountIn` value

    // Calculate amount out + our fees (0.5% fee)
    uint256 amountInWithFees = (amountIn * 995) / 1000;

    // We determine the amount of tokens to withdraw by comparing the reserved amount of pairs
    amountOut = ((amountInWithFees * resOut) / resIn);

    // update `reserve0` and `reserve1`
    (uint256 res0, uint256 res1) = isToken0
      ? (resIn + amountIn, resOut - amountOut)
      : (resOut - amountOut, resIn + amountIn);

    _update(res0, res1);

    // Transfer tokens to the user
    tokenOut.transfer(msg.sender, amountOut);

    // console.log("CSAMM token0 balance:", tokenIn.balanceOf(address(this)));
    // console.log("CSAMM token1 balance:", tokenOut.balanceOf(address(this)));
    // console.log("Swapper token0 balance:", tokenIn.balanceOf(msg.sender));
    // console.log("Swapper token1 balance:", tokenOut.balanceOf(msg.sender));
    // console.log("reserve0:", getReserve0());
    // console.log("reserve1:", getReserve1());
    // console.log("totalSupply", getTotalSupply());

    emit Swapped(
      msg.sender,
      address(tokenIn),
      _amountIn,
      address(tokenOut),
      amountOut
    );
  }

  /**
   * @notice add new tokens into the liquidity pool
   * @dev This contract behaves that token0 and token1 are swaped in ration 1 : 1
   *
   * @param _amount0 first token amount to add to the liquidity pool
   * @param _amount1 secnod token amount to add to the liquidity pool
   */
  function addLiquidity(
    uint256 _amount0,
    uint256 _amount1
  ) external returns (uint256 shares) {
    // Transfer tokens to our contract
    _i_token0.transferFrom(msg.sender, address(this), _amount0);
    _i_token1.transferFrom(msg.sender, address(this), _amount1);

    uint256 bal0 = _i_token0.balanceOf(address(this));
    uint256 bal1 = _i_token1.balanceOf(address(this));

    uint256 d0 = bal0 - _reserve0;
    uint256 d1 = bal1 - _reserve1;

    /*
      a = amount in
      L = total liquidity
      s = shares to mint
      T = total supply

      s should be proportional to increase from L to L + a
      (L + a) / L = (T + s) / T

      s = (a * T) / L
    */

    if (_totalSupply == 0) {
      shares = d0 + d1;
    } else {
      shares = ((d0 + d1) * _totalSupply) / (_reserve0 + _reserve1);
    }

    if (shares <= 0) revert CSAMM__SharesEqualZero(shares);

    // Add new tokens to the user
    _mint(msg.sender, shares);

    // Update the reserved value in our contract
    _update(bal0, bal1);

    emit LiquidityAdded(msg.sender, d0, d1);
  }

  /**
   * @notice remove pair of tokens from the liquidity pool
   *
   * @param _shares Amount of tokens (from the two tokens) that will be removed
   * @return d0 The removed value of the first token
   * @return d1 The removed value of the second token
   */
  function removeLiquidity(
    uint256 _shares
  ) external returns (uint256 d0, uint256 d1) {
    if (balanceOf[msg.sender] == 0) {
      revert CSAMM__SharesEqualZero(balanceOf[msg.sender]);
    }
    /*
      a = amount out
      L = total liquidity
      s = shares
      T = total supply

      a / L = s / T

      a = L * s / T
        = (reserve0 + reserve1) * s / T
    */

    d0 = (_reserve0 * _shares) / _totalSupply;
    d1 = (_reserve1 * _shares) / _totalSupply;

    _burn(msg.sender, _shares);
    _update(_reserve0 - d0, _reserve1 - d1);

    if (d0 > 0) {
      _i_token0.transfer(msg.sender, d0);
    }

    if (d1 > 0) {
      _i_token1.transfer(msg.sender, d1);
    }

    emit LiquidityRemoved(msg.sender, d0, d1);
  }

  ///////////////////////////////////////////////
  //////// private and internal function ////////
  ///////////////////////////////////////////////

  /**
   * @notice mint new tokens and add it to a given address
   * @dev there is no acutal minting in token, just the user info updated in our contracr
   * @dev minting increases the `totalSupply` of the contract
   *
   * @param _to Address that will receive the minted tokens
   * @param _amount the amount of tokens to be minted
   */
  function _mint(address _to, uint256 _amount) private {
    // console.log("The Amount to be added to ", _to, ": ", _amount);
    balanceOf[_to] += _amount;
    _totalSupply += _amount;
  }

  /**
   * @notice burn  tokens and remove it from a given address
   * @dev there is no acutal burning in token, just the user info updated in our contracr
   * @dev burning decreases the `totalSupply` of the contract
   *
   * @param _from Address that the tokens will be burned from
   * @param _amount the amount of tokens to be burned
   */
  function _burn(address _from, uint256 _amount) private {
    balanceOf[_from] -= _amount;
    _totalSupply -= _amount;
  }

  /**
   * @notice update the value of the reserved tokens
   *
   * @param _res0 new value of the first token pair reserved value
   * @param _res1 new value of the second token pair reserved value
   */
  function _update(uint256 _res0, uint256 _res1) private {
    _reserve0 = _res0;
    _reserve1 = _res1;
  }

  ///////////////////////////////////////////////
  /////// Getter, View, and Pure function ///////
  ///////////////////////////////////////////////

  function getToken0Address() public view returns (address) {
    return address(_i_token0);
  }

  function getToken1Address() public view returns (address) {
    return address(_i_token1);
  }

  /// @notice returns the totalSupply of tokens in the contract
  /// @dev this supply represends first pair + second pair supply
  function getTotalSupply() public view returns (uint256) {
    return _totalSupply;
  }

  /// @notice return the value of tokens of the first pair
  function getReserve0() public view returns (uint256) {
    return _reserve0;
  }

  /// @notice return the value of tokens of the second pair
  function getReserve1() public view returns (uint256) {
    return _reserve1;
  }
}
