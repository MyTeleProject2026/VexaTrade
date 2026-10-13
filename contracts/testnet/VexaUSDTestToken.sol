// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VexaUSD Test Token
/// @notice Test-only ERC-20 for public testnets. It is NOT Tether USDt/USDT,
///         has no redemption value, and must never be presented as a real deposit.
contract VexaUSDTestToken {
    string public constant name = "VexaUSD Test Token";
    string public constant symbol = "vUSD-TEST";
    uint8 public constant decimals = 6;

    address public immutable owner;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "OWNER_ONLY");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit Transfer(address(0), msg.sender, 0);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        require(spender != address(0), "ZERO_SPENDER");
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 permitted = allowance[from][msg.sender];
        require(permitted >= value, "ALLOWANCE_EXCEEDED");
        if (permitted != type(uint256).max) {
            allowance[from][msg.sender] = permitted - value;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, value);
        return true;
    }

    /// @notice Mint test tokens for demonstrations on a testnet only.
    function mintTestTokens(address to, uint256 value) external onlyOwner {
        require(to != address(0), "ZERO_RECIPIENT");
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "ZERO_RECIPIENT");
        uint256 balance = balanceOf[from];
        require(balance >= value, "INSUFFICIENT_TEST_TOKEN_BALANCE");
        unchecked {
            balanceOf[from] = balance - value;
        }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
