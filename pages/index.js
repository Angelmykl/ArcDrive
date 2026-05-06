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

  fetch(`/api/share?address=${account.address}`)
    .then((res) => res.json())
    .then((data) => {
      setSharedFiles(data.files || []);
    })
    .catch((err) => {
      console.error("Failed to load shared files:", err);
    });

}, [account]);

useEffect(() => {
  if (!account) return;

  const saved = localStorage.getItem(`arcdrive_files_${account.address}`);

  if (saved) {
    setFiles(JSON.parse(saved));
  }
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
      return await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: account.address,
          to: account.address,
          value: "0x38d7ea4c68000",
          gas: "0x5208",
        }],
      });
    } catch {
      return null;
    }
  }

  async function handleUpload() {
    if (!selectedFile) return setStatus("Select a file first");
    if (!account) return setStatus("Connect wallet");

    try {
      setStatus("Pay to upload...");
      const paid = await payForUpload(account);
      if (!paid) return setStatus("Payment cancelled ❌");

      setStatus("Encrypting...");
      const { encrypted, key, iv } = await encryptFile(selectedFile);

      // 🔐 Ask for sharing
      const recipient = prompt("Enter wallet to share with (optional):");

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

      if (!data.IpfsHash) throw new Error("Upload failed");

      const cid = "ipfs://" + data.IpfsHash;

      saveKey(cid, key, iv);

      // 🔐 Share logic
      if (recipient && recipient !== account.address) {
        try {
          const encryptedKey = await window.ethereum.request({
            method: "eth_encrypt",
            params: [key, recipient],
          });

          localStorage.setItem(
            `arcdrive_shared_${recipient}_${cid}`,
            JSON.stringify({ encryptedKey, iv })
          );
        } catch (e) {
          console.log("Share failed", e);
        }
      }

      const updatedFiles = [
        { name: selectedFile.name, cid },
        ...files,
      ];

      setFiles(updatedFiles);

      localStorage.setItem(
        `arcdrive_files_${account.address}`,
        JSON.stringify(updatedFiles)
      );

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
if (!stored && file.key && file.iv) {
  stored = {
    key: file.key,
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

    const stored = loadKey(file.cid);
    if (!stored) {
      alert("No encryption key found ❌");
      return;
    }

    // 🔐 STEP A — SIGN (wallet popup)
    await window.ethereum.request({
      method: "personal_sign",
      params: [
        `Share ${file.name} with ${recipient}`,
        account.address,
      ],
    });

    let encryptedKey = stored.key;

    // 🔒 STEP C — TRY REAL ENCRYPTION (if supported)
    try {
      const publicKey = await window.ethereum.request({
        method: "eth_getEncryptionPublicKey",
        params: [recipient],
      });

      encryptedKey = btoa(publicKey + ":" + stored.key); // fallback simple encoding
    } catch (e) {
      console.warn("Encryption not supported, fallback used");
    }

    // 🌍 STEP B — SEND TO BACKEND (GLOBAL)
    await fetch("/api/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: account.address,
        to: recipient,
        cid: file.cid,
        name: file.name,
        key: encryptedKey,
        iv: stored.iv,
      }),
    });

    alert("File shared globally ✅");

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