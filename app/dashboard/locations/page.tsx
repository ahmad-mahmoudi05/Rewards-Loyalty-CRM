import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export default async function LocationsPage() {
  const membership = await requireBusinessContext();
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Locations</h1>
        <p className="text-sm text-foreground/70">
          Every location shares this business&apos;s customers and loyalty program by
          default.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-foreground/10 rounded-lg border border-foreground/10">
        {locations?.length ? (
          locations.map((location) => (
            <div key={location.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {location.name}
                  {location.is_primary && (
                    <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-normal text-foreground/70">
                      Primary
                    </span>
                  )}
                </p>
                {location.address && <p className="text-xs text-foreground/60">{location.address}</p>}
              </div>
              {location.phone && <p className="text-xs text-foreground/60">{location.phone}</p>}
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-foreground/60">No locations yet.</p>
        )}
      </div>
    </div>
  );
}
