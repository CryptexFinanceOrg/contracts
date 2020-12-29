// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/introspection/ERC165Checker.sol";
import "./IVaultHandler.sol";
import "./TCAP.sol";
import "./oracles/ChainlinkOracle.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TCAP Orchestrator
 * @author Cristian Espinoza
 * @notice Orchestrator contract in charge of managing the settings of the vaults and TCAP token
 */
contract Orchestrator is Ownable {
  /** @dev Logs the unlock function. */
  event LogUnlock(address indexed _contract, Functions _fn, bytes32 _hash);
  /** @dev Enum which saves the available functions to unlock. */
  enum Functions {RATIO, BURNFEE, LIQUIDATION, ENABLECAP, SETCAP}
  /** @dev Mapping that checks if Function on vault is timelocked */
  mapping(address => mapping(Functions => uint256)) public timelock;
  /** @dev Mapping that saves a hash of the value to be updated to make sure it updates the same value */
  mapping(address => mapping(Functions => bytes32)) public timelockValue;
  /** @dev vault functions are timelocked for 3 days*/
  uint256 public constant _TIMELOCK = 3 days;

  /** @dev Interface constants*/
  bytes4 private constant _INTERFACE_ID_IVAULT = 0x9e75ab0c;
  bytes4 private constant _INTERFACE_ID_TCAP = 0xa9ccee51;
  bytes4 private constant _INTERFACE_ID_CHAINLINK_ORACLE = 0x85be402b;

  /**
   * @notice Throws if vault is locked.
   * @param _contract address
   * @param _fn function identifier
   * @param _value hash of value
   * @dev checks if the timelocked value is the same
   */
  modifier notLocked(
    address _contract,
    Functions _fn,
    bytes32 _value
  ) {
    require(
      timelock[_contract][_fn] != 0 &&
        timelock[_contract][_fn] <= block.timestamp,
      "Function is timelocked"
    );
    require(
      timelockValue[_contract][_fn] == _value,
      "Not defined timelock value"
    );
    _;
  }

  /**
   * @notice Throws if vault is not valid.
   * @param _vault address
   */
  modifier validVault(IVaultHandler _vault) {
    require(
      ERC165Checker.supportsInterface(address(_vault), _INTERFACE_ID_IVAULT),
      "Not a valid vault"
    );
    _;
  }

  /**
   * @notice Throws if TCAP Token is not valid.
   * @param _tcap address
   */
  modifier validTCAP(TCAP _tcap) {
    require(
      ERC165Checker.supportsInterface(address(_tcap), _INTERFACE_ID_TCAP),
      "Not a valid TCAP ERC20"
    );
    _;
  }

  /**
   * @notice Throws if Chainlink Oracle is not valid.
   * @param _oracle address
   */
  modifier validChainlinkOracle(address _oracle) {
    require(
      ERC165Checker.supportsInterface(
        address(_oracle),
        _INTERFACE_ID_CHAINLINK_ORACLE
      ),
      "Not a valid Chainlink Oracle"
    );
    _;
  }

  /**
   * @dev CREATED AS STACK IS TOO DEEP ON INITIALIZE
   * @notice Throws if Chainlink Oracle is not valid
   * @param _oracle address
   */
  function _validChainlinkOracle(address _oracle) private view {
    require(
      ERC165Checker.supportsInterface(
        address(_oracle),
        _INTERFACE_ID_CHAINLINK_ORACLE
      ),
      "Not a valid Chainlink Oracle"
    );
  }

  /**
   * @notice Unlocks contract function
   * @param _contract address
   * @param _fn to be unlocked
   * @dev Only owner can call it
   * @dev Unlock time is = block.timestamp + _TIMELOCK
   * @dev A hash of the value to save is passed as proof for users that the changing value is correct.
   */
  function unlockFunction(
    address _contract,
    Functions _fn,
    bytes32 _hash
  ) external onlyOwner {
    timelock[address(_contract)][_fn] = block.timestamp + _TIMELOCK;
    timelockValue[address(_contract)][_fn] = _hash;
    emit LogUnlock(_contract, _fn, _hash);
  }

  /**
   * @notice Locks contract function
   * @param _contract address
   * @param _fn to be locked
   * @dev Lock happens immediately
   */
  function _lockFunction(address _contract, Functions _fn) private {
    timelock[address(_contract)][_fn] = 0;
    timelockValue[address(_contract)][_fn] = 0;
  }

  /**
   * @notice Locks vault function
   * @param _vault address
   * @param _fn to be locked
   * @dev Only owner can call it
   * @dev Lock happens immediately
   */
  function lockVaultFunction(IVaultHandler _vault, Functions _fn)
    external
    onlyOwner
  {
    _lockFunction(address(_vault), _fn);
  }

  /**
   * @notice Sets the ratio of a vault
   * @param _vault address
   * @param _ratio value
   * @dev Only owner can call it
   * @dev Validates if _vault is valid and not locked
   * @dev Locks function after using
   */
  function setRatio(IVaultHandler _vault, uint256 _ratio)
    external
    onlyOwner
    validVault(_vault)
    notLocked(
      address(_vault),
      Functions.RATIO,
      keccak256(abi.encodePacked(_ratio))
    )
  {
    _vault.setRatio(_ratio);
    _lockFunction(address(_vault), Functions.RATIO);
  }

  /**
   * @notice Sets the burn fee of a vault
   * @param _vault address
   * @param _burnFee value
   * @dev Only owner can call it
   * @dev Validates if _vault is valid and not locked
   * @dev Locks function after using
   */
  function setBurnFee(IVaultHandler _vault, uint256 _burnFee)
    external
    onlyOwner
    validVault(_vault)
    notLocked(
      address(_vault),
      Functions.BURNFEE,
      keccak256(abi.encodePacked(_burnFee))
    )
  {
    _vault.setBurnFee(_burnFee);
    _lockFunction(address(_vault), Functions.BURNFEE);
  }

  /**
   * @notice Sets the burn fee to 0, only used on a black swan event
   * @param _vault address
   * @dev Only owner can call it
   * @dev Validates if _vault is valid
   * @dev Locks function after using
   */
  function setEmergencyBurnFee(IVaultHandler _vault)
    external
    onlyOwner
    validVault(_vault)
  {
    _vault.setBurnFee(0);
    _lockFunction(address(_vault), Functions.BURNFEE);
  }

  /**
   * @notice Sets the liquidation penalty of a vault
   * @param _vault address
   * @param _liquidationPenalty value
   * @dev Only owner can call it
   * @dev Validates if _vault is valid and not locked
   * @dev Locks function after using
   */
  function setLiquidationPenalty(
    IVaultHandler _vault,
    uint256 _liquidationPenalty
  )
    external
    onlyOwner
    validVault(_vault)
    notLocked(
      address(_vault),
      Functions.LIQUIDATION,
      keccak256(abi.encodePacked(_liquidationPenalty))
    )
  {
    _vault.setLiquidationPenalty(_liquidationPenalty);
    _lockFunction(address(_vault), Functions.LIQUIDATION);
  }

  /**
   * @notice Sets the liquidation penalty of a vault to 0, only used on a black swan event
   * @param _vault address
   * @dev Only owner can call it
   * @dev Validates if _vault is valid
   * @dev Locks function after using
   */
  function setEmergencyLiquidationPenalty(IVaultHandler _vault)
    external
    onlyOwner
    validVault(_vault)
  {
    _vault.setLiquidationPenalty(0);
    _lockFunction(address(_vault), Functions.LIQUIDATION);
  }

  /**
   * @notice Pauses the Vault
   * @param _vault address
   * @dev Only owner can call it
   * @dev Validates if _vault is valid
   */
  function pauseVault(IVaultHandler _vault)
    external
    onlyOwner
    validVault(_vault)
  {
    _vault.pause();
  }

  /**
   * @notice Unpauses the Vault
   * @param _vault address
   * @dev Only owner can call it
   * @dev Validates if _vault is valid
   */
  function unpauseVault(IVaultHandler _vault)
    external
    onlyOwner
    validVault(_vault)
  {
    _vault.unpause();
  }

  /**
   * @notice Retrieves a vault fees and put it on the Orchestrator
   * @param _vault address
   * @dev Only owner can call it
   * @dev Validates if _vault is valid
   */
  function retrieveVaultFees(IVaultHandler _vault)
    external
    onlyOwner
    validVault(_vault)
  {
    _vault.retrieveFees();
  }

  /**
   * @notice Retrieves the fees on the orchestrator
   * @dev Only owner can call it
   * @dev Transfer the balance to the contract owner
   */
  function retrieveFees() external onlyOwner {
    uint256 amount = address(this).balance;
    payable(owner()).transfer(amount);
  }

  /**
   * @notice Enables or disables the TCAP Cap
   * @param _tcap address
   * @param _enable bool
   * @dev Only owner can call it
   * @dev Validates if _tcap is valid
   */
  function enableTCAPCap(TCAP _tcap, bool _enable)
    external
    onlyOwner
    validTCAP(_tcap)
    notLocked(
      address(_tcap),
      Functions.ENABLECAP,
      keccak256(abi.encodePacked(_enable))
    )
  {
    _tcap.enableCap(_enable);
    _lockFunction(address(_tcap), Functions.ENABLECAP);
  }

  /**
   * @notice Sets the TCAP maximum minting value
   * @param _tcap address
   * @param _cap uint value
   * @dev Only owner can call it
   * @dev Validates if _tcap is valid
   */
  function setTCAPCap(TCAP _tcap, uint256 _cap)
    external
    onlyOwner
    validTCAP(_tcap)
    notLocked(
      address(_tcap),
      Functions.SETCAP,
      keccak256(abi.encodePacked(_cap))
    )
  {
    _tcap.setCap(_cap);
    _lockFunction(address(_tcap), Functions.SETCAP);
  }

  /**
   * @notice Adds Vault to TCAP ERC20
   * @param _tcap address
   * @param _vault address
   * @dev Only owner can call it
   * @dev Validates if _tcap is valid
   * @dev Validates if _vault is valid
   */
  function addTCAPVault(TCAP _tcap, IVaultHandler _vault)
    external
    onlyOwner
    validTCAP(_tcap)
    validVault(_vault)
  {
    _tcap.addTokenHandler(address(_vault));
  }

  /**
   * @notice Allows the contract to receive ETH
   */
  receive() external payable {}
}
