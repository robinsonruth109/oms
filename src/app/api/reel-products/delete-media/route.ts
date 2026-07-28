import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteMediaBody = {
  publicId?: unknown;
  resourceType?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

async function requireAdmin() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return jsonError(
        "You are not authorised to delete reel media.",
        401
      );
    }

    let body: DeleteMediaBody;

    try {
      body = (await request.json()) as DeleteMediaBody;
    } catch {
      return jsonError("A valid JSON body is required.", 400);
    }

    const publicId =
      typeof body.publicId === "string"
        ? body.publicId.trim()
        : "";

    const resourceType =
      body.resourceType === "image" ||
      body.resourceType === "video"
        ? body.resourceType
        : null;

    if (!publicId) {
      return jsonError("Cloudinary public ID is required.", 400);
    }

    if (!resourceType) {
      return jsonError(
        'Resource type must be either "image" or "video".',
        400
      );
    }

    const {
      deleteCloudinaryAsset,
      isReelCloudinaryPublicId,
    } = await import("@/lib/cloudinary");

    if (!isReelCloudinaryPublicId(publicId)) {
      return jsonError(
        "This asset does not belong to the Reel Products folder.",
        403
      );
    }

    const result = await deleteCloudinaryAsset({
      publicId,
      resourceType,
    });

    if (
      result.result !== "ok" &&
      result.result !== "not found"
    ) {
      console.error(
        "Unexpected Cloudinary deletion result:",
        result
      );

      return jsonError(
        "Cloudinary could not delete the media asset.",
        502
      );
    }

    return NextResponse.json({
      success: true,
      message:
        result.result === "not found"
          ? "The media asset was already absent."
          : "Reel media deleted successfully.",
      result: result.result,
      publicId,
      resourceType,
    });
  } catch (error) {
    console.error("Reel media deletion failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected deletion error occurred.";

    if (
      message.includes("CLOUDINARY_CLOUD_NAME") ||
      message.includes("CLOUDINARY_API_KEY") ||
      message.includes("CLOUDINARY_API_SECRET")
    ) {
      return jsonError(
        "Cloudinary has not been configured correctly.",
        500
      );
    }

    return jsonError("The reel media deletion failed.", 500);
  }
}