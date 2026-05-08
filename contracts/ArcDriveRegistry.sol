// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArcDriveRegistry {

    struct FileRecord {
        address owner;
        string cid;
        string name;
        uint256 uploadedAt;
    }

    FileRecord[] public files;

    mapping(address => uint256[]) public userFiles;

    // 🚀 cid => wallet => access
    mapping(string => mapping(address => bool)) public access;

    // 🚀 REGISTER FILE
    function registerFile(
        string memory cid,
        string memory name
    ) public {

        files.push(
            FileRecord(
                msg.sender,
                cid,
                name,
                block.timestamp
            )
        );

        userFiles[msg.sender].push(files.length - 1);

        // owner always has access
        access[cid][msg.sender] = true;
    }

    // 🚀 SHARE FILE
    function shareFile(
        string memory cid,
        address user
    ) public {

        bool isOwner = false;

        // verify ownership
        for (uint256 i = 0; i < files.length; i++) {

            if (
                keccak256(bytes(files[i].cid)) ==
                keccak256(bytes(cid))
                &&
                files[i].owner == msg.sender
            ) {
                isOwner = true;
                break;
            }
        }

        require(isOwner, "Not file owner");

        access[cid][user] = true;
    }

    // 🚀 CHECK ACCESS
    function canAccess(
        string memory cid,
        address user
    ) public view returns (bool) {

        return access[cid][user];
    }

    // 🚀 GET USER FILES
    function getUserFiles(address user)
        public
        view
        returns (uint256[] memory)
    {
        return userFiles[user];
    }

    // 🚀 GET FILE
    function getFile(uint256 index)
        public
        view
        returns (
            address,
            string memory,
            string memory,
            uint256
        )
    {
        FileRecord memory file = files[index];

        return (
            file.owner,
            file.cid,
            file.name,
            file.uploadedAt
        );
    }
}