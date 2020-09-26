var expect = require("chai").expect;
var ethersProvider = require("ethers");
const bre = require("@nomiclabs/buidler");

describe("Orchestrator Contract", async function () {
	let orchestratorInstance, tcapInstance, tcapInstance2, ethVaultInstance, btcVaultInstance;
	let [owner, addr1, handler, handler2] = [];
	let accounts = [];
	let divisor = "10000000000";
	let ratio = "150";
	let burnFee = "1";
	let liquidationPenalty = "10";
	let tcapOracle = (collateralAddress = collateralOracle = ethOracle =
		ethersProvider.constants.AddressZero);
	const THREE_DAYS = 259200;
	const TWO_DAYS = 172800;

	const fns = {
		DIVISOR: 0,
		RATIO: 1,
		BURNFEE: 2,
		LIQUIDATION: 3,
		TCAP: 4,
		TCAPORACLE: 5,
		COLLATERAL: 6,
		COLLATERALORACLE: 7,
		ETHORACLE: 8,
	};

	before("Set Accounts", async () => {
		let [acc0, acc1, acc3, acc4, acc5] = await ethers.getSigners();
		owner = acc0;
		addr1 = acc1;
		handler = acc3;
		handler2 = acc4;
		if (owner && addr1 && handler) {
			accounts.push(await owner.getAddress());
			accounts.push(await addr1.getAddress());
			accounts.push(await handler.getAddress());
			accounts.push(await handler2.getAddress());
			accounts.push(await acc5.getAddress());
		}
	});
	//TODO: print logs on sets

	it("...should deploy the contract", async () => {
		const orchestrator = await ethers.getContractFactory("Orchestrator");
		orchestratorInstance = await orchestrator.deploy();
		await orchestratorInstance.deployed();
		expect(orchestratorInstance.address).properAddress;
		//Vaults
		const wethVault = await ethers.getContractFactory("VaultHandler");
		ethVaultInstance = await wethVault.deploy(orchestratorInstance.address);
		await ethVaultInstance.deployed();
		expect(ethVaultInstance.address).properAddress;

		btcVaultInstance = await wethVault.deploy(orchestratorInstance.address);
		await btcVaultInstance.deployed();
		expect(btcVaultInstance.address).properAddress;
		//TCAP
		const TCAP = await ethers.getContractFactory("TCAP");
		tcapInstance = await TCAP.deploy(
			"Total Market Cap Token",
			"TCAP",
			18,
			orchestratorInstance.address
		);
		await tcapInstance.deployed();
		tcapInstance2 = await TCAP.deploy(
			"Total Market Cap Token",
			"TCAP2",
			18,
			orchestratorInstance.address
		);
		await tcapInstance2.deployed();
		//Chainlink Oracles
		const aggregator = await ethers.getContractFactory("AggregatorInterface");
		let aggregatorInstance = await aggregator.deploy();
		const oracle = await ethers.getContractFactory("ChainlinkOracle");
		let chainlinkInstance = await oracle.deploy(aggregatorInstance.address);
		await chainlinkInstance.deployed();
		tcapOracle = chainlinkInstance.address;
		chainlinkInstance = await oracle.deploy(aggregatorInstance.address);
		await chainlinkInstance.deployed();
		collateralOracle = chainlinkInstance.address;
		chainlinkInstance = await oracle.deploy(aggregatorInstance.address);
		await chainlinkInstance.deployed();
		ethOracle = chainlinkInstance.address;
		//Collateral
		const weth = await ethers.getContractFactory("WETH");
		let wethTokenInstance = await weth.deploy();
		collateralAddress = wethTokenInstance.address;
	});

	it("...should set the owner", async () => {
		const defaultOwner = await orchestratorInstance.owner();
		expect(defaultOwner).to.eq(accounts[0]);
	});

	it("...should validate the data on initialize", async () => {
		await expect(
			orchestratorInstance.initializeVault(
				ethersProvider.constants.AddressZero,
				divisor,
				ratio,
				burnFee,
				liquidationPenalty,
				tcapOracle,
				tcapInstance.address,
				collateralAddress,
				collateralOracle,
				ethOracle
			)
		).to.be.revertedWith("Not a valid vault");

		await expect(
			orchestratorInstance.initializeVault(
				ethVaultInstance.address,
				divisor,
				ratio,
				burnFee,
				liquidationPenalty,
				ethersProvider.constants.AddressZero,
				tcapInstance.address,
				collateralAddress,
				collateralOracle,
				ethOracle
			)
		).to.be.revertedWith("Not a valid Chainlink Oracle");

		await expect(
			orchestratorInstance.initializeVault(
				ethVaultInstance.address,
				divisor,
				ratio,
				burnFee,
				liquidationPenalty,
				tcapOracle,
				ethersProvider.constants.AddressZero,
				collateralAddress,
				collateralOracle,
				ethOracle
			)
		).to.be.revertedWith("Not a valid TCAP ERC20");

		await expect(
			orchestratorInstance.initializeVault(
				ethVaultInstance.address,
				divisor,
				ratio,
				burnFee,
				liquidationPenalty,
				tcapOracle,
				tcapInstance.address,
				collateralAddress,
				ethersProvider.constants.AddressZero,
				ethOracle
			)
		).to.be.revertedWith("Not a valid Chainlink Oracle");

		await expect(
			orchestratorInstance.initializeVault(
				ethVaultInstance.address,
				divisor,
				ratio,
				burnFee,
				liquidationPenalty,
				tcapOracle,
				tcapInstance.address,
				collateralAddress,
				collateralOracle,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not a valid Chainlink Oracle");
	});

	it("...should initialize vault contracts", async () => {
		await expect(
			orchestratorInstance
				.connect(addr1)
				.initializeVault(
					ethVaultInstance.address,
					divisor,
					ratio,
					burnFee,
					liquidationPenalty,
					tcapOracle,
					tcapInstance.address,
					collateralAddress,
					collateralOracle,
					ethOracle
				)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await orchestratorInstance.initializeVault(
			ethVaultInstance.address,
			divisor,
			ratio,
			burnFee,
			liquidationPenalty,
			tcapOracle,
			tcapInstance.address,
			collateralAddress,
			collateralOracle,
			ethOracle
		);
		expect(divisor).to.eq(await ethVaultInstance.divisor());
		expect(ratio).to.eq(await ethVaultInstance.ratio());
		expect(burnFee).to.eq(await ethVaultInstance.burnFee());
		expect(liquidationPenalty).to.eq(await ethVaultInstance.liquidationPenalty());
		expect(tcapOracle).to.eq(await ethVaultInstance.tcapOracle());
		expect(tcapInstance.address).to.eq(await ethVaultInstance.TCAPToken());
		expect(collateralAddress).to.eq(await ethVaultInstance.collateralContract());
		expect(collateralOracle).to.eq(await ethVaultInstance.collateralPriceOracle());
		expect(ethOracle).to.eq(await ethVaultInstance.ETHPriceOracle());
	});
	it("...shouldn't allow a vault to initialize more than once", async () => {
		await expect(
			orchestratorInstance.initializeVault(
				ethVaultInstance.address,
				divisor,
				ratio,
				burnFee,
				liquidationPenalty,
				tcapOracle,
				tcapInstance.address,
				collateralAddress,
				collateralOracle,
				ethOracle
			)
		).to.be.revertedWith("Contract already initialized");
	});

	it("...should allow to unlock timelock for a function", async () => {
		let divisorHash = ethers.utils.solidityKeccak256(["uint256"], [divisor]);
		await expect(
			orchestratorInstance
				.connect(addr1)
				.unlockVaultFunction(ethVaultInstance.address, fns.DIVISOR, divisorHash)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.DIVISOR,
			divisorHash
		);
		expect(await orchestratorInstance.timelock(ethVaultInstance.address, fns.DIVISOR)).to.not.eq(0);
		expect(await orchestratorInstance.timelockValue(ethVaultInstance.address, fns.DIVISOR)).to.eq(
			divisorHash
		);
		expect(Date.now()).to.lte(
			(await orchestratorInstance.timelock(ethVaultInstance.address, fns.DIVISOR)).mul(1000)
		);

		await expect(orchestratorInstance.setDivisor(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [TWO_DAYS]);
		await expect(orchestratorInstance.setDivisor(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [TWO_DAYS]);
		await expect(orchestratorInstance.setDivisor(btcVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
		await expect(orchestratorInstance.setDivisor(ethVaultInstance.address, 200)).to.be.revertedWith(
			"Not defined timelock value"
		);
		await orchestratorInstance.setDivisor(ethVaultInstance.address, divisor);
	});

	it("...should allow to lock again a function", async () => {
		await expect(
			orchestratorInstance.connect(addr1).lockVaultFunction(ethVaultInstance.address, fns.DIVISOR)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await orchestratorInstance.lockVaultFunction(ethVaultInstance.address, fns.DIVISOR);
		expect(await orchestratorInstance.timelock(ethVaultInstance.address, fns.DIVISOR)).to.eq(0);
	});

	it("...should set vault divisor", async () => {
		let divisor = "20000000000";
		let divisorHash = ethers.utils.solidityKeccak256(["uint256"], [divisor]);

		await expect(orchestratorInstance.setDivisor(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.DIVISOR,
			divisorHash
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.connect(addr1).setDivisor(ethVaultInstance.address, 0)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setDivisor(ethersProvider.constants.AddressZero, 0)
		).to.be.revertedWith("Not a valid vault");

		await expect(orchestratorInstance.setDivisor(ethVaultInstance.address, 200)).to.be.revertedWith(
			"Not defined timelock value"
		);

		await orchestratorInstance.setDivisor(ethVaultInstance.address, divisor);
		expect(divisor).to.eq(await ethVaultInstance.divisor());

		await expect(orchestratorInstance.setDivisor(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
	});

	it("...should set vault ratio", async () => {
		let ratio = "200";
		let ratioHash = ethers.utils.solidityKeccak256(["uint256"], [ratio]);

		await expect(orchestratorInstance.setRatio(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
		await orchestratorInstance.unlockVaultFunction(ethVaultInstance.address, fns.RATIO, ratioHash);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.connect(addr1).setRatio(ethVaultInstance.address, 0)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setRatio(ethersProvider.constants.AddressZero, 0)
		).to.be.revertedWith("Not a valid vault");

		await expect(orchestratorInstance.setRatio(btcVaultInstance.address, ratio)).to.be.revertedWith(
			"Function is timelocked"
		);

		await expect(orchestratorInstance.setRatio(ethVaultInstance.address, 10)).to.be.revertedWith(
			"Not defined timelock value"
		);

		await orchestratorInstance.setRatio(ethVaultInstance.address, ratio);
		expect(ratio).to.eq(await ethVaultInstance.ratio());

		await expect(orchestratorInstance.setRatio(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
	});

	it("...should set vault burn fee", async () => {
		let burnFee = "2";
		let feeHash = ethers.utils.solidityKeccak256(["uint256"], [burnFee]);

		await expect(orchestratorInstance.setBurnFee(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
		await orchestratorInstance.unlockVaultFunction(ethVaultInstance.address, fns.BURNFEE, feeHash);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.connect(addr1).setBurnFee(ethVaultInstance.address, 0)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setBurnFee(ethersProvider.constants.AddressZero, 0)
		).to.be.revertedWith("Not a valid vault");

		await expect(orchestratorInstance.setBurnFee(ethVaultInstance.address, 10)).to.be.revertedWith(
			"Not defined timelock value"
		);

		await orchestratorInstance.setBurnFee(ethVaultInstance.address, burnFee);
		expect(burnFee).to.eq(await ethVaultInstance.burnFee());
		await expect(orchestratorInstance.setBurnFee(ethVaultInstance.address, 0)).to.be.revertedWith(
			"Function is timelocked"
		);
	});

	it("...should set vault liquidation penalty", async () => {
		let liquidationPenalty = "15";
		let penaltyHash = ethers.utils.solidityKeccak256(["uint256"], [liquidationPenalty]);

		await expect(
			orchestratorInstance.setLiquidationPenalty(ethVaultInstance.address, 0)
		).to.be.revertedWith("Function is timelocked");
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.LIQUIDATION,
			penaltyHash
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.connect(addr1).setLiquidationPenalty(ethVaultInstance.address, 0)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setLiquidationPenalty(ethersProvider.constants.AddressZero, 0)
		).to.be.revertedWith("Not a valid vault");

		await expect(
			orchestratorInstance.setLiquidationPenalty(ethVaultInstance.address, 10)
		).to.be.revertedWith("Not defined timelock value");

		await orchestratorInstance.setLiquidationPenalty(ethVaultInstance.address, liquidationPenalty);
		expect(liquidationPenalty).to.eq(await ethVaultInstance.liquidationPenalty());
		await expect(
			orchestratorInstance.setLiquidationPenalty(ethVaultInstance.address, 0)
		).to.be.revertedWith("Function is timelocked");
	});

	it("...should set vault TCAP Contract", async () => {
		let tcap = tcapInstance2.address;
		let tcapHash = ethers.utils.solidityKeccak256(["address"], [tcap]);

		await expect(orchestratorInstance.setTCAP(ethVaultInstance.address, tcap)).to.be.revertedWith(
			"Function is timelocked"
		);
		await orchestratorInstance.unlockVaultFunction(ethVaultInstance.address, fns.TCAP, tcapHash);

		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);
		await expect(
			orchestratorInstance
				.connect(addr1)
				.setTCAP(ethVaultInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setTCAP(ethersProvider.constants.AddressZero, tcap)
		).to.be.revertedWith("Not a valid vault");

		await expect(
			orchestratorInstance.setTCAP(ethVaultInstance.address, tcapInstance.address)
		).to.be.revertedWith("Not defined timelock value");

		await orchestratorInstance.setTCAP(ethVaultInstance.address, tcap);
		expect(tcap).to.eq(await ethVaultInstance.TCAPToken());
		await expect(
			orchestratorInstance.setTCAP(ethVaultInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Function is timelocked");

		tcapHash = ethers.utils.solidityKeccak256(["address"], [ethersProvider.constants.AddressZero]);
		await orchestratorInstance.unlockVaultFunction(ethVaultInstance.address, fns.TCAP, tcapHash);
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.setTCAP(ethVaultInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Not a valid TCAP ERC20");
	});

	it("...should set vault TCAP Oracle Contract", async () => {
		let tcapOracle = collateralOracle;
		let tcapHash = ethers.utils.solidityKeccak256(["address"], [tcapOracle]);

		await expect(
			orchestratorInstance.setTCAPOracle(ethVaultInstance.address, tcapOracle)
		).to.be.revertedWith("Function is timelocked");
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.TCAPORACLE,
			tcapHash
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance
				.connect(addr1)
				.setTCAPOracle(ethVaultInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setTCAPOracle(ethersProvider.constants.AddressZero, tcapOracle)
		).to.be.revertedWith("Not a valid vault");

		await expect(
			orchestratorInstance.setTCAPOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not defined timelock value");

		await orchestratorInstance.setTCAPOracle(ethVaultInstance.address, tcapOracle);
		expect(tcapOracle).to.eq(await ethVaultInstance.tcapOracle());
		await expect(
			orchestratorInstance.setTCAPOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Function is timelocked");

		tcapHash = ethers.utils.solidityKeccak256(["address"], [ethersProvider.constants.AddressZero]);
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.TCAPORACLE,
			tcapHash
		);
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.setTCAPOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not a valid Chainlink Oracle");
	});

	it("...should set vault Collateral Contract", async () => {
		const weth = await ethers.getContractFactory("WETH");
		let wethTokenInstance = await weth.deploy();
		let collateralContract = wethTokenInstance.address;
		let collateralHash = ethers.utils.solidityKeccak256(["address"], [collateralContract]);

		await expect(
			orchestratorInstance.setCollateral(ethVaultInstance.address, collateralContract)
		).to.be.revertedWith("Function is timelocked");
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.COLLATERAL,
			collateralHash
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance
				.connect(addr1)
				.setCollateral(ethVaultInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setCollateral(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not defined timelock value");

		await orchestratorInstance.setCollateral(ethVaultInstance.address, collateralContract);
		expect(collateralContract).to.eq(await ethVaultInstance.collateralContract());
		await expect(
			orchestratorInstance.setCollateral(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Function is timelocked");

		collateralHash = ethers.utils.solidityKeccak256(
			["address"],
			[ethersProvider.constants.AddressZero]
		);
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.COLLATERAL,
			collateralHash
		);
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.setCollateral(ethersProvider.constants.AddressZero, collateralContract)
		).to.be.revertedWith("Not a valid vault");
	});

	it("...should set vault Collateral Oracle Contract", async () => {
		let collateralOracle = ethOracle;
		let collateralHash = ethers.utils.solidityKeccak256(["address"], [ethOracle]);

		await expect(
			orchestratorInstance.setCollateralOracle(ethVaultInstance.address, collateralOracle)
		).to.be.revertedWith("Function is timelocked");
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.COLLATERALORACLE,
			collateralHash
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance
				.connect(addr1)
				.setCollateralOracle(ethVaultInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setCollateralOracle(
				ethersProvider.constants.AddressZero,
				collateralOracle
			)
		).to.be.revertedWith("Not a valid vault");

		await expect(
			orchestratorInstance.setCollateralOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not defined timelock value");

		await orchestratorInstance.setCollateralOracle(ethVaultInstance.address, collateralOracle);
		expect(collateralOracle).to.eq(await ethVaultInstance.collateralPriceOracle());
		await expect(
			orchestratorInstance.setCollateralOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Function is timelocked");

		collateralHash = ethers.utils.solidityKeccak256(
			["address"],
			[ethersProvider.constants.AddressZero]
		);
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.COLLATERALORACLE,
			collateralHash
		);
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.setCollateralOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not a valid Chainlink Oracle");
	});

	it("...should set vault ETH Oracle Contract", async () => {
		let ethOracle = tcapOracle;
		let oracleHash = ethers.utils.solidityKeccak256(["address"], [tcapOracle]);

		await expect(
			orchestratorInstance.setETHOracle(ethVaultInstance.address, ethOracle)
		).to.be.revertedWith("Function is timelocked");
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.ETHORACLE,
			oracleHash
		);
		//fast-forward
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance
				.connect(addr1)
				.setETHOracle(ethVaultInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setETHOracle(ethersProvider.constants.AddressZero, ethOracle)
		).to.be.revertedWith("Not a valid vault");

		await expect(
			orchestratorInstance.setETHOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not defined timelock value");

		await orchestratorInstance.setETHOracle(ethVaultInstance.address, ethOracle);
		expect(ethOracle).to.eq(await ethVaultInstance.ETHPriceOracle());
		await expect(
			orchestratorInstance.setETHOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Function is timelocked");

		oracleHash = ethers.utils.solidityKeccak256(
			["address"],
			[ethersProvider.constants.AddressZero]
		);
		await orchestratorInstance.unlockVaultFunction(
			ethVaultInstance.address,
			fns.ETHORACLE,
			oracleHash
		);
		bre.network.provider.send("evm_increaseTime", [THREE_DAYS]);

		await expect(
			orchestratorInstance.setETHOracle(
				ethVaultInstance.address,
				ethersProvider.constants.AddressZero
			)
		).to.be.revertedWith("Not a valid Chainlink Oracle");
	});

	it("...should pause the Vault", async () => {
		await expect(
			orchestratorInstance.connect(addr1).pauseVault(ethVaultInstance.address)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.pauseVault(ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Not a valid vault");

		await orchestratorInstance.pauseVault(ethVaultInstance.address);
		expect(true).to.eq(await ethVaultInstance.paused());
	});

	it("...should unpause the vault", async () => {
		await expect(
			orchestratorInstance.connect(addr1).unpauseVault(ethVaultInstance.address)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.unpauseVault(ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Not a valid vault");

		await orchestratorInstance.unpauseVault(ethVaultInstance.address);
		expect(false).to.eq(await ethVaultInstance.paused());
	});

	it("...should be able to retrieve funds from vault", async () => {
		await expect(
			orchestratorInstance.connect(addr1).retrieveVaultFees(ethVaultInstance.address)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.retrieveVaultFees(ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Not a valid vault");

		await expect(orchestratorInstance.retrieveVaultFees(ethVaultInstance.address))
			.to.emit(ethVaultInstance, "LogRetrieveFees")
			.withArgs(orchestratorInstance.address, 0);
	});

	it("...should be able to send funds to owner of orchestrator", async () => {
		await expect(orchestratorInstance.connect(addr1).retrieveFees()).to.be.revertedWith(
			"Ownable: caller is not the owner"
		);

		//tested on vault
		await orchestratorInstance.retrieveFees();
	});

	it("...should enable the TCAP cap", async () => {
		await expect(
			orchestratorInstance.connect(addr1).enableTCAPCap(tcapInstance.address, true)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.enableTCAPCap(ethersProvider.constants.AddressZero, true)
		).to.be.revertedWith("Not a valid TCAP ERC20");

		await expect(orchestratorInstance.enableTCAPCap(tcapInstance.address, true))
			.to.emit(tcapInstance, "LogEnableCap")
			.withArgs(orchestratorInstance.address, true);
	});

	it("...should set the TCAP cap", async () => {
		await expect(
			orchestratorInstance.connect(addr1).setTCAPCap(tcapInstance.address, 0)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.setTCAPCap(ethersProvider.constants.AddressZero, 100)
		).to.be.revertedWith("Not a valid TCAP ERC20");

		await expect(orchestratorInstance.setTCAPCap(tcapInstance.address, 100))
			.to.emit(tcapInstance, "LogSetCap")
			.withArgs(orchestratorInstance.address, 100);
	});

	it("...should add vault to TCAP token", async () => {
		await expect(
			orchestratorInstance
				.connect(addr1)
				.addTCAPVault(tcapInstance.address, ethVaultInstance.address)
		).to.be.revertedWith("Ownable: caller is not the owner");

		await expect(
			orchestratorInstance.addTCAPVault(
				ethersProvider.constants.AddressZero,
				ethVaultInstance.address
			)
		).to.be.revertedWith("Not a valid TCAP ERC20");

		await expect(
			orchestratorInstance.addTCAPVault(tcapInstance.address, ethersProvider.constants.AddressZero)
		).to.be.revertedWith("Not a valid vault");

		await expect(orchestratorInstance.addTCAPVault(tcapInstance.address, ethVaultInstance.address))
			.to.emit(tcapInstance, "LogAddTokenHandler")
			.withArgs(orchestratorInstance.address, ethVaultInstance.address);
	});
});
