export function isLocalOnly(): boolean {
  // Client 側で参照する可能性があるため NEXT_PUBLIC_* を優先
  return (
    process.env.NEXT_PUBLIC_GYMAPP_LOCAL_ONLY === "1" ||
    process.env.GYMAPP_LOCAL_ONLY === "1"
  );
}
