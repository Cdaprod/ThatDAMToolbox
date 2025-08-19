/**
 * AssetsPage renders a list of assets using Incremental Static Regeneration.
 * Example: navigate to /assets in the running web app.
 */
export const revalidate = 60;

export default async function AssetsPage() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/explorer/assets?limit=100`,
  );
  if (!res.ok) {
    throw new Error('Failed to fetch assets');
  }
  const data = await res.json();
  return (
    <ul>
      {data.items?.map((item: any) => (
        <li key={item.id}>{item.name ?? item.id}</li>
      ))}
    </ul>
  );
}
