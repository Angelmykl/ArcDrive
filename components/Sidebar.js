export default function Sidebar() {
  return (
    <div
      style={{
        width: "240px",
        background: "rgba(15,23,42,0.9)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: "30px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <h2
        style={{
          color: "white",
          fontSize: "28px",
          marginBottom: "20px",
        }}
      >
        ArcDrive
      </h2>

      {[
        "Dashboard",
        "Files",
        "Shared",
        "Activity",
        "SDK",
      ].map((item) => (
        <div
          key={item}
          style={{
            padding: "14px 18px",
            borderRadius: "14px",
            color: "#cbd5e1",
            cursor: "pointer",
            transition: "0.2s",
            background:
              item === "Dashboard"
                ? "rgba(99,102,241,0.15)"
                : "transparent",
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}