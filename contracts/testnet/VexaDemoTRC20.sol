// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Vexa Demo Token
/// @notice Test-token for VexaTrade integration QA on TRON Nile testnet only.
/// @dev This is NOT Tether USDt, is not redeemable, and must never be marketed as real USDT.
contract VexaDemoTRC20 {
    string public constant name = "Vexa Demo Token";
    string public constant symbol = "VDEMO";
    uint8 public constant decimals = 6;

    address public owner;
    uint256 public totalSupply;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** decimals;
    bool public paused;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PauseChanged(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "VDEMO: owner only");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VDEMO: transfers paused");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "VDEMO: zero owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseChanged(value);
    }

    /// @notice Mints clearly labeled test tokens. Deploy/use on Nile testnet only.
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        require(to != address(0), "VDEMO: zero recipient");
        require(amount > 0, "VDEMO: zero amount");
        require(totalSupply + amount <= MAX_SUPPLY, "VDEMO: max supply exceeded");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external whenNotPaused returns (bool) {
        require(spender != address(0), "VDEMO: zero spender");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external whenNotPaused returns (bool) {
        uint256 permitted = allowance[from][msg.sender];
        require(permitted >= amount, "VDEMO: allowance exceeded");
        if (permitted != type(uint256).max) {
            allowance[from][msg.sender] = permitted - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "VDEMO: zero recipient");
        require(balanceOf[from] >= amount, "VDEMO: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
