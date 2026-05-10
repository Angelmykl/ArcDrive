# ArcDrive

> Decentralized cloud storage built on Arc Network.
> Own your Files. Pay with USDC.

ArcDrive is a decentralized cloud storage platform that enables users to securely upload, encrypt, manage, and share files using Web3 infrastructure and USDC-powered payments.

Built on Arc Network, ArcDrive combines decentralized storage, wallet-based authentication, encrypted file sharing, and on-chain verification into a modern Web3 file management experience.

---

# ✨ Features

* 🔐 End-to-end encrypted file uploads
* ☁️ Decentralized storage with IPFS
* 💵 USDC-powered upload & sharing payments
* 👛 Wallet-based authentication
* 🤝 Secure file sharing between wallets
* ⛓️ On-chain file verification
* 📜 Activity tracking dashboard
* ⚡ Modern responsive dashboard UI
* 🧩 SDK-ready architecture

---

# 🖥️ Dashboard Preview

## Main Dashboard

* Storage overview
* Upload management
* Shared files
* Activity tracking

## File Sharing

* Share encrypted files directly to wallet addresses
* Receiver can securely download shared files

---

# 🛠️ Tech Stack

* **Frontend:** Next.js
* **Blockchain:** Arc Network
* **Smart Contracts:** Solidity
* **Wallet Connection:** Thirdweb
* **Storage:** IPFS
* **Database:** Supabase
* **Payments:** USDC
* **Web3 Library:** Ethers.js

---

# 📦 Smart Contract

### ArcDrive Registry Contract

```txt
0x99F0fFb2c2F874BB5A492F59f7F5F44B81125528
```

---

# ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=

NEXT_PUBLIC_SUPABASE_URL=

NEXT_PUBLIC_SUPABASE_ANON_KEY=

PRIVATE_KEY=
```

---

# 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/Angelmykl/ArcDrive.git
```

Move into the project folder:

```bash
cd ArcDrive
```

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

---

# 🌐 Live Demo

https://arc-drive-xi.vercel.app/

---

# 🔄 ArcDrive Architecture

## Upload Flow

```txt
User Uploads File
        ↓
File Encryption
        ↓
IPFS Upload
        ↓
Metadata Stored in Supabase
        ↓
Hash Registered On-Chain
```

---

## Sharing Flow

```txt
Owner Shares File
        ↓
Encrypted Metadata Shared
        ↓
Receiver Authenticates Wallet
        ↓
Secure Download + Decryption
```

---

# 📁 Project Structure

```txt
ArcDrive/
│
├── components/
├── contracts/
├── lib/
├── pages/
├── scripts/
├── styles/
├── artifacts/
└── README.md
```

---

# 🔐 Security

ArcDrive uses encrypted file handling and wallet-based verification to ensure users maintain ownership and control over their uploaded files.

Sensitive credentials are stored using environment variables and excluded from version control.

---

# 🧩 ArcDrive SDK (Upcoming)

ArcDrive is evolving into a decentralized storage infrastructure layer.

Upcoming SDK features:

* File upload APIs
* Encrypted sharing SDK
* Developer integrations
* USDC payment utilities
* Storage management APIs

---

# 🗺️ Roadmap

* [x] Encrypted file uploads
* [x] USDC payment integration
* [x] Wallet authentication
* [x] Secure file sharing
* [x] Dashboard UI redesign
* [ ] ArcDrive SDK
* [ ] Mobile support
* [ ] Storage subscriptions
* [ ] Developer API
* [ ] Cross-chain support

---

# 🤝 Contributing

Contributions, ideas, and feedback are welcome.

Fork the repo and submit a pull request.

---

# 📜 License

MIT License

---

# 🌍 Vision

ArcDrive aims to become decentralized storage infrastructure for emerging markets — enabling secure, affordable, and user-owned cloud storage powered by stablecoin payments and Web3 technology.
