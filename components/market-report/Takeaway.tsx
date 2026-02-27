export default function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 19,
        fontWeight: 400,
        lineHeight: 1.55,
        color: "#1a1a1a",
        borderLeft: "3px solid #2c5f4a",
        paddingLeft: 20,
        marginBottom: 44,
      }}
    >
      {children}
    </div>
  );
}
