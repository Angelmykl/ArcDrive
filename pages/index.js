import { ethers } from "ethers";
import { supabase } from "../lib/supabase";
import { useState, useEffect } from "react";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

export default function Home() {
  const account = useActiveAccount();

  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [status, setStatus] = useState("");

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
  console.error("SHARE ERROR:", error);

  alert(
    "Sharing failed ❌ " +
    (error.message || JSON.stringify(error))
  );

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
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>ArcDrive</h1>
          <p style={styles.subtitle}>
            Decentralized cloud storage built on Arc Network. Own your Files. Pay with USDC
          </p>
        </div>

        <ConnectButton client={client} />
      </div>

      <div style={styles.card}>
        <h3>Upload</h3>

        <div style={styles.uploadRow}>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            style={styles.fileInput}
          />

          <button style={styles.button} onClick={handleUpload}>
            Upload
          </button>
        </div>

        {status && <p style={styles.status}>{status}</p>}
      </div>

      <div style={styles.card}>
        <h3>My Files</h3>

        {files.map((file, i) => (
  <div key={i} style={styles.fileCard}>
    <span>{file.name}</span>

    <div style={{ display: "flex", gap: "8px" }}>
      <button
        style={styles.downloadBtn}
        onClick={() => downloadFile(file)}
      >
        Download + Decrypt
      </button>

      <button
        style={{ ...styles.downloadBtn, background: "#f59e0b" }}
        onClick={() => shareFile(file)}
      >
        Share
      </button>
    </div>
  </div>
))}
      </div>

      {/* 🔐 NEW SECTION */}
      <div style={styles.card}>
        <h3>Shared With Me</h3>

        {sharedFiles.length === 0 && (
          <p style={{ opacity: 0.5 }}>No shared files</p>
        )}

        {sharedFiles.map((file, i) => (
          <div key={i} style={styles.fileCard}>
            <span>{file.name}</span>
            <button style={styles.downloadBtn} onClick={() => downloadFile(file)}>
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
const styles = {
  container: {
    background: "#020617",
    minHeight: "100vh",
    padding: "30px",
    color: "white",
    fontFamily: "sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  title: {
    fontSize: "34px",
    fontWeight: "bold",
  },
  subtitle: {
    opacity: 0.7,
    marginTop: "5px",
    fontSize: "14px",
  },
  card: {
    background: "#0f172a",
    padding: "20px",
    borderRadius: "10px",
    marginTop: "20px",
  },
  uploadRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginTop: "10px",
  },
  fileInput: {
    padding: "6px",
    borderRadius: "6px",
    border: "1px solid #1e293b",
    background: "#020617",
    color: "white",
  },
  button: {
    padding: "10px 16px",
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
  },
  downloadBtn: {
    padding: "6px 12px",
    background: "#22c55e",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
  },
  fileCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#020617",
    padding: "10px",
    borderRadius: "6px",
    marginTop: "10px",
  },
  status: {
    marginTop: "10px",
    fontSize: "14px",
    opacity: 0.8,
  },
};