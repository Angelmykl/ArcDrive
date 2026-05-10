import { ConnectButton } from "thirdweb/react";

export default function DashboardLayout({
  client,
  children,
  files,
  sharedFiles,
}) {
  const menuItems = [
    { name: "Dashboard", id: "dashboard" },
    { name: "Files", id: "files" },
    { name: "Shared", id: "shared" },
    { name: "Activity", id: "activity" },
    { name: "SDK", id: "sdk" },
  ];

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background:
          "linear-gradient(to bottom right, #020617, #0f172a)",
        color: "white",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* SIDEBAR */}
      <div
        style={{
          width: "200px",
          padding: "24px 16px",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(2,6,23,0.7)",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        {menuItems.map((item, i) => (
          <a
            key={i}
            href={`#${item.id}`}
            style={{
              display: "block",
              padding: "14px 16px",
              borderRadius: "12px",
              marginBottom: "12px",
              background:
                item.name === "Dashboard"
                  ? "rgba(99,102,241,0.2)"
                  : "transparent",
              cursor: "pointer",
              color: "#e2e8f0",
              fontWeight: 500,
              transition: "0.2s",
              textDecoration: "none",
              fontSize: "13px",
            }}
          >
            {item.name}
          </a>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <div
        style={{
          flex: 1,
          padding: "20px 22px",
          maxWidth: "1400px",
          width: "100%",
        }}
      >
        {/* HERO */}
        <div
          id="dashboard"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
            gap: "20px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "30px",
                marginBottom: "12px",
                fontWeight: "700",
                letterSpacing: "-2px",
              }}
            >
              ArcDrive
            </h1>

            <p
              style={{
                color: "#cbd5e1",
                fontSize: "13px",
                lineHeight: 1.6,
                maxWidth: "700px",
              }}
            >
              Decentralized cloud storage built on Arc Network.
              Own your Files. Pay with USDC.
            </p>
          </div>

          <ConnectButton client={client} />
        </div>

        {/* STATS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          {[
            {
              title: "Storage Used",
              value: "1.42 GB",
              sub: "of 10 GB",
            },
            {
              title: "Total Files",
              value: files.length,
              sub: "files uploaded",
            },
            {
              title: "Shared Files",
              value: sharedFiles.length,
              sub: "files shared",
            },
            {
              title: "On-Chain Verified",
              value: files.length,
              sub: "files registered",
            },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                padding: "18px",
                borderRadius: "20px",
                background: "rgba(15,23,42,0.75)",
                border:
                  "1px solid rgba(255,255,255,0.05)",
                backdropFilter: "blur(12px)",
              }}
            >
              <p
                style={{
                  color: "#94a3b8",
                  marginBottom: "10px",
                  fontSize: "13px",
                }}
              >
                {card.title}
              </p>

              <h2
                style={{
                  fontSize: "21px",
                  marginBottom: "8px",
                  fontWeight: "700",
                }}
              >
                {card.value}
              </h2>

              <span
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                {card.sub}
              </span>
            </div>
          ))}
        </div>

        {children}
      </div>
    </div>
  );
}