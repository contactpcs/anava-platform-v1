"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { upsertOne } from "@/store/slices/appointmentsSlice";
import { upsertRequest, addRequest } from "@/store/slices/appointmentRequestsSlice";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Appointment, AppointmentRequest } from "@/types/domain.types";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function SocketInit() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!SOCKET_URL) return;
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;

    let socket: import("socket.io-client").Socket | null = null;

    import("socket.io-client").then(({ io }) => {
      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
      });

      const onAppt = ({ appointment }: { appointment: Appointment }) => {
        if (appointment) dispatch(upsertOne(appointment));
      };
      const onReq = ({ request }: { request: AppointmentRequest }) => {
        if (request) dispatch(addRequest(request));
      };
      const onReqUpdate = ({ request }: { request: AppointmentRequest }) => {
        if (request) dispatch(upsertRequest(request));
      };

      socket.on("appointment:created",  onAppt);
      socket.on("appointment:updated",  onAppt);
      socket.on("appointment:cancelled", onAppt);
      socket.on("appointment_request:created",              onReq);
      socket.on("appointment_request:approved",             onReqUpdate);
      socket.on("appointment_request:rejected",             onReqUpdate);
      socket.on("appointment_request:cancelled_by_patient", onReqUpdate);
    });

    return () => { socket?.disconnect(); };
  }, [dispatch]);

  return null;
}
