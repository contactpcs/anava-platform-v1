"use client";

import { useEffect, useState } from "react";
import { User, Mail, Phone, MapPin, Building2, ShieldCheck, Calendar } from "lucide-react";
import { usersService } from "@/lib/api/services/users.service";
import { useAuth } from "@/lib/hooks";
import { Card, CardHeader, CardContent, PageLoader } from "@/components/ui";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <div>
        <p className="text-xs text-neutral-400 leading-tight">{label}</p>
        <p className="text-sm font-medium text-neutral-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function ReceptionistProfilePage() {
  const { user: authUser } = useAuth();
  // profile = full data from /users/profile (may include clinic info not in JWT)
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    usersService
      .getProfile()
      .then((p: any) => setProfile(p))
      .catch(() => setProfile(authUser))
      .finally(() => setIsLoading(false));
  }, [authUser]);

  if (isLoading) return <PageLoader />;

  // merge: profile wins over authUser for richer data
  const data: any = profile ?? authUser;

  const firstName = data?.first_name || data?.firstName || data?.full_name?.split(" ")[0] || "";
  const lastName  = data?.last_name  || data?.lastName  || data?.full_name?.split(" ").slice(1).join(" ") || "";
  const fullName  = data?.full_name  || `${firstName} ${lastName}`.trim() || "Unknown";
  const initials  = (firstName[0] || "?").toUpperCase() + (lastName[0] || "").toUpperCase();

  const clinicName  = data?.clinic_name  || data?.clinic?.name   || null;
  const clinicCity  = data?.clinic_city  || data?.clinic?.city   || data?.clinic?.location || null;
  const clinicDisplay = clinicName || clinicCity;

  const roles: string[] = Array.isArray(data?.roles) ? data.roles : (data?.role ? [data.role] : []);

  const dob = data?.date_of_birth || data?.dob;
  const dobFormatted = dob
    ? new Date(dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const gender = data?.gender
    ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1)
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-neutral-900">My Profile</h1>

      {/* Header card */}
      <Card>
        <CardContent className="flex items-center gap-5 py-6">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-neutral-900 leading-tight">{fullName}</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Receptionist</p>
            {clinicDisplay && (
              <p className="flex items-center gap-1.5 text-xs text-blue-600 font-medium mt-1.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {clinicDisplay}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-neutral-700">Contact Information</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow icon={Mail}     label="Email Address"  value={data?.email} />
          <InfoRow icon={Phone}    label="Phone Number"   value={data?.phone} />
          <InfoRow icon={Calendar} label="Date of Birth"  value={dobFormatted} />
          <InfoRow icon={User}     label="Gender"         value={gender} />
        </CardContent>
      </Card>

      {/* Clinic */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-neutral-700">Clinic Information</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {clinicName && <InfoRow icon={Building2} label="Clinic Name"     value={clinicName} />}
          {clinicCity  && <InfoRow icon={MapPin}    label="Clinic Location" value={clinicCity} />}
          {!clinicName && !clinicCity && (
            <p className="text-sm text-neutral-400 col-span-2">
              Clinic information is not available. Please contact your administrator.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Role & Access */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-neutral-700">Role &amp; Access</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Assigned Roles</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {roles.length > 0 ? roles.map((r) => (
                  <span
                    key={r}
                    className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium capitalize"
                  >
                    {String(r).replace(/_/g, " ")}
                  </span>
                )) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                    Receptionist
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
