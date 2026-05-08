async function main() {
  const Contract = await ethers.getContractFactory("ArcDriveRegistry");

  const contract = await Contract.deploy();

  await contract.waitForDeployment();

  console.log(
    "ArcDriveRegistry deployed to:",
    await contract.getAddress()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});