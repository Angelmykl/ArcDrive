import DashboardLayout from "../components/DashboardLayout";
import { ethers } from "ethers";
import { supabase } from "../lib/supabase";
import { useState, useEffect } from "react";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
} from "../lib/contract";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

export default function Home() {
  const account = useActiveAccount();

  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [status, setStatus] = useState("");

const [showAllFiles, setShowAllFiles] = useState(false);
const [showAllShared, setShowAllShared] = useState(false);

 useEffect(() => {
  if (!account) return;

  async function loadFiles() {
    const { data } = await supabase
      .from("files")
      .select("*")
      .eq("wallet", account.address);

    if (data) {
      setFiles(data);
    }

    const { data: shared } = await supabase
      .from("shared_files")
      .select("*")
      .eq("receiver", account.address);

    if (shared) {
      setSharedFiles(shared);
    }
  }

  loadFiles();
}, [account]);

  function toBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
  }

  function fromBase64(base64) {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  async function encryptFile(file) {
    const data = await file.arrayBuffer();

    const key = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      "AES-GCM",
      false,
      ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      data
    );

    return {
      encrypted: toBase64(encrypted),
      key: toBase64(key),
      iv: toBase64(iv),
    };
  }

 function saveKey(cid, key, iv) {
  if (!account) return;

  localStorage.setItem(
    `arcdrive_${account.address}_${cid}`,
    JSON.stringify({ key, iv })
  );
}

  function loadKey(cid) {
    if (!account) return null;

    const data = localStorage.getItem(
      `arcdrive_${account.address}_${cid}`
    );

    return data ? JSON.parse(data) : null;
  }

  async function payForUpload(account) {
  try {
    // ARC TESTNET
    const ARC_CHAIN_ID = "0x4cef52";

    // Switch to Arc network
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID }],
    });

    const provider = new ethers.BrowserProvider(window.ethereum);

    const signer = await provider.getSigner();

    // YOUR WALLET (receives upload fee)
    const RECEIVER = account.address;

    // 0.01 USDC
    const tx = await signer.sendTransaction({
      to: RECEIVER,
      value: ethers.parseEther("0.001"),
    });

    setStatus("Waiting for payment confirmation...");

    await tx.wait();

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
}

async function payForShare(account) {
  try {
    const ARC_CHAIN_ID = "0x4cef52";

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID }],
    });

    const provider = new ethers.BrowserProvider(window.ethereum);

    const signer = await provider.getSigner();

    const RECEIVER = account.address;

    const tx = await signer.sendTransaction({
      to: RECEIVER,
      value: ethers.parseEther("0.0005"),
    });

    setStatus("Waiting for share payment confirmation...");

    await tx.wait();

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
}

  async function handleUpload() {
  if (!selectedFile) return setStatus("Select a file first");
  if (!account) return setStatus("Connect wallet");

  try {
    setStatus("Pay to upload...");

    const paid = await payForUpload(account);

    if (!paid) {
      setStatus("Payment cancelled ❌");
      return;
    }

    setStatus("Encrypting...");

    const { encrypted, key, iv } = await encryptFile(selectedFile);

    const encryptedBlob = new Blob(
      [JSON.stringify({ encrypted })],
      { type: "application/json" }
    );

    const fileToUpload = new File(
      [encryptedBlob],
      selectedFile.name + ".enc"
    );

    setStatus("Uploading...");

    const formData = new FormData();
    formData.append("file", fileToUpload);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const raw = await res.text();
    const data = JSON.parse(raw);

    if (!data.IpfsHash) {
      throw new Error("Upload failed");
    }

    const cid = "ipfs://" + data.IpfsHash;

    // SAVE KEY LOCALLY
    saveKey(cid, key, iv);

    // SAVE TO SUPABASE
    const { error } = await supabase
      .from("files")
      .insert([
        {
          wallet: account.address,
          name: selectedFile.name,
          cid,
          encrypted_key: key,
          iv,
        },
      ]);

    if (error) {
  console.error("SUPABASE ERROR:", error);

  setStatus(
    "Database save failed ❌ " +
    (error.message || JSON.stringify(error))
  );

  return;
}

// 🚀 REGISTER ON ARC BLOCKCHAIN
const provider = new ethers.BrowserProvider(window.ethereum);

const signer = await provider.getSigner();

const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  signer
);

setStatus("Registering ownership on Arc...");

const tx = await contract.registerFile(
  cid,
  selectedFile.name
);

await tx.wait();

setStatus("File ownership registered on-chain ✅");

    // UPDATE UI
    const newFile = {
      wallet: account.address,
      name: selectedFile.name,
      cid,
      encrypted_key: key,
      iv,
    };

    setFiles((prev) => [newFile, ...prev]);

    setSelectedFile(null);

    setStatus("Upload successful ✅");

  } catch (err) {
    console.error(err);
    setStatus("Upload failed ❌ " + err.message);
  }
}

  async function downloadFile(file) {
  try {
    let stored = loadKey(file.cid);

    // 🔐 Check shared access (FROM BACKEND)
if (!stored && file.encrypted_key && file.iv) {
  stored = {
    key: file.encrypted_key,
    iv: file.iv,
  };
}

    if (!stored) {
      alert("Not your file ❌");
      return;
    }

    const url = file.cid.replace(
      "ipfs://",
      "https://gateway.pinata.cloud/ipfs/"
    );

    const res = await fetch(url);
    const json = await res.json();

    const encrypted = fromBase64(json.encrypted);
    const key = fromBase64(stored.key);
    const iv = fromBase64(stored.iv);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      "AES-GCM",
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encrypted
    );

    const blob = new Blob([decrypted]);
    const urlBlob = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = file.name;
    a.click();

  } catch (err) {
    console.error(err);
    setStatus("Decryption failed ❌");
  }
}

// 👇 ADD HERE
async function shareFile(file) {
  try {
    const recipient = prompt("Enter wallet address:");

    if (!recipient) return;

    // 💰 PAY SHARE FEE
    setStatus("Paying share fee...");

    const paid = await payForShare(account);

    if (!paid) {
      setStatus("Share payment cancelled ❌");
      return;
    }

    let stored = loadKey(file.cid);

    // fallback from Supabase
    if (!stored && file.encrypted_key && file.iv) {
      stored = {
        key: file.encrypted_key,
        iv: file.iv,
      };
    }

    if (!stored) {
      alert("No encryption key found ❌");
      return;
    }

    // wallet popup
    await window.ethereum.request({
      method: "personal_sign",
      params: [
        `Share ${file.name} with ${recipient}`,
        account.address,
      ],
    });

    // 🚀 BLOCKCHAIN SHARE
const provider = new ethers.BrowserProvider(window.ethereum);

const signer = await provider.getSigner();

const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  signer
);

setStatus("Confirm share permission on Arc...");

const tx = await contract.shareFile(
  file.cid,
  recipient
);

await tx.wait();
const { error } = await supabase
  .from("shared_files")
  .insert([
    {
      owner: account.address,
      receiver: recipient,
      name: file.name,
      cid: file.cid,
      encrypted_key: stored.key,
      iv: stored.iv,
    },
  ]);

if (error) {
  console.error(error);
  alert("Failed to save shared file ❌");
  return;
}

    setStatus("File shared successfully ✅");

setTimeout(() => {
  setStatus("");
}, 5000);

  } catch (err) {
    console.error(err);
    alert("Sharing failed ❌");
  }
}

  return (
  <DashboardLayout
    client={client}
    files={files}
    sharedFiles={sharedFiles}
  >

  {/* UPLOAD SECTION */}
<div
  style={{
    background: "rgba(15,23,42,0.8)",
    padding: "28px",
    borderRadius: "24px",
    marginBottom: "30px",
    border: "1px solid rgba(255,255,255,0.05)",
  }}
>
  <h2
    style={{
      marginBottom: "20px",
      fontSize: "18px",
    }}
  >
    Upload File
  </h2>

  <div
    style={{
      display: "flex",
      gap: "20px",
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <input
      type="file"
      onChange={(e) =>
        setSelectedFile(e.target.files[0])
      }
      style={{
        padding: "14px",
        borderRadius: "14px",
        background: "#020617",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "white",
        flex: 1,
        minWidth: "250px",
      }}
    />

    <button
      onClick={handleUpload}
      style={{
        background:
          "linear-gradient(to right, #4f46e5, #7c3aed)",
        border: "none",
        color: "white",
        padding: "14px 28px",
        borderRadius: "14px",
        cursor: "pointer",
        fontWeight: "600",
        fontSize: "15px",
      }}
    >
      Upload
    </button>
  </div>

  {status && (
    <p
      style={{
        marginTop: "18px",
        color: "#94a3b8",
      }}
    >
      {status}
    </p>
  )}
</div>

{/* FILES SECTION */}
<div
  id="files"
  style={{
    background: "rgba(15,23,42,0.8)",
    padding: "28px",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.05)",
    marginBottom: "30px",
  }}
>
  <h2
    style={{
      marginBottom: "24px",
      fontSize: "24px",
    }}
  >
    My Files
  </h2>

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    }}
  >
    {(showAllFiles ? files : files.slice(0, 5)).map((file, i) => (
      <div
        key={i}
        style={{
          background: "#020617",
          borderRadius: "18px",
          padding: "14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          border:
            "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div>
          <h3
            style={{
              marginBottom: "8px",
              fontSize: "17px",
            }}
          >
            {file.name}
          </h3>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                padding: "6px 10px",
                borderRadius: "999px",
                fontSize: "12px",
              }}
            >
              Encrypted
            </span>

            <span
              style={{
                background: "rgba(59,130,246,0.15)",
                color: "#3b82f6",
                padding: "6px 10px",
                borderRadius: "999px",
                fontSize: "12px",
              }}
            >
              IPFS
            </span>

            <span
              style={{
                background: "rgba(168,85,247,0.15)",
                color: "#a855f7",
                padding: "6px 10px",
                borderRadius: "999px",
                fontSize: "12px",
              }}
            >
              Arc Verified
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => downloadFile(file)}
            style={{
              background:
                "rgba(34,197,94,0.12)",
              color: "#22c55e",
              border:
                "1px solid rgba(34,197,94,0.2)",
              padding: "12px 18px",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Download
          </button>

          <button
            onClick={() => shareFile(file)}
            style={{
              background:
                "rgba(245,158,11,0.12)",
              color: "#f59e0b",
              border:
                "1px solid rgba(245,158,11,0.2)",
              padding: "12px 18px",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Share
          </button>
        </div>
      </div>
    ))}

{files.length > 5 && (
  <button
    onClick={() =>
      setShowAllFiles(!showAllFiles)
    }
    style={{
      marginTop: "20px",
      background: "transparent",
      color: "#7c3aed",
      border:
        "1px solid rgba(124,58,237,0.3)",
      padding: "10px 16px",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
    }}
  >
    {showAllFiles
      ? "Show Less"
      : "View All Files"}
  </button>
)}

  </div>
</div>

{/* SHARED FILES */}
<div
  id="shared"
  style={{
    background: "rgba(15,23,42,0.8)",
    padding: "28px",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.05)",
  }}
>
  <h2
    style={{
      marginBottom: "24px",
      fontSize: "24px",
    }}
  >
    Shared With Me
  </h2>

  {sharedFiles.length === 0 ? (
    <p style={{ color: "#64748b" }}>
      No shared files yet
    </p>
  ) : (
    <>
      {(showAllShared
        ? sharedFiles
        : sharedFiles.slice(0, 5)
      ).map((file, i) => (
        <div
          key={i}
          style={{
            background: "#020617",
            borderRadius: "18px",
            padding: "14px",
            marginBottom: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span>{file.name}</span>

          <button
            onClick={() => downloadFile(file)}
            style={{
              background:
                "rgba(59,130,246,0.12)",
              color: "#3b82f6",
              border:
                "1px solid rgba(59,130,246,0.2)",
              padding: "12px 18px",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Download
          </button>
        </div>
      ))}

      {sharedFiles.length > 5 && (
        <button
          onClick={() =>
            setShowAllShared(!showAllShared)
          }
          style={{
            marginTop: "20px",
            background: "transparent",
            color: "#3b82f6",
            border:
              "1px solid rgba(59,130,246,0.3)",
            padding: "10px 16px",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
          }}
        >
          {showAllShared
            ? "Show Less"
            : "View All Shared Files"}
        </button>
      )}
    </>
  )}
</div>

{/* ACTIVITY */}
<div
  id="activity"
  style={{
    background: "rgba(15,23,42,0.8)",
    padding: "28px",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.05)",
    marginTop: "30px",
  }}
>
  <h2
    style={{
      marginBottom: "24px",
      fontSize: "24px",
    }}
  >
    Activity
  </h2>

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    }}
  >
    <div
      style={{
        background: "#020617",
        padding: "16px",
        borderRadius: "14px",
      }}
    >
      File uploaded to IPFS
    </div>

    <div
      style={{
        background: "#020617",
        padding: "16px",
        borderRadius: "14px",
      }}
    >
      Ownership registered on Arc
    </div>

    <div
      style={{
        background: "#020617",
        padding: "16px",
        borderRadius: "14px",
      }}
    >
      File shared on-chain
    </div>
  </div>
</div>

</DashboardLayout>
);
}