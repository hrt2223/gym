export function LogoutForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <button type="submit" className="text-sm text-foreground">
        ログアウト
      </button>
    </form>
  );
}
