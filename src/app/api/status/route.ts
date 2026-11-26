import { NextResponse } from "next/server";
import { getStorageMode } from "@/lib/store";

export async function GET() {
  return NextResponse.json({
    storageMode: getStorageMode(),
  });
}
