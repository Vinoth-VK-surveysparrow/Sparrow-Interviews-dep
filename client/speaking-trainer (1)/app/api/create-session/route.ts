import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { gameType, settings } = await request.json()

    console.log("[v0] Creating game session server-side:", { gameType, settings })

    const anonymousUserId = crypto.randomUUID()

    // Create anonymous user record
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        id: anonymousUserId,
        email: `anonymous_${Date.now()}@temp.local`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (userError) {
      console.error("[v0] User creation error:", userError)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    console.log("[v0] Anonymous user created:", user.id)

    const difficultyMap = { beginner: 1, intermediate: 2, advanced: 3 }
    const difficultyLevel = difficultyMap[settings.settings?.difficulty as keyof typeof difficultyMap] || 1

    const { data: session, error } = await supabase
      .from("game_sessions")
      .insert({
        user_id: anonymousUserId,
        game_type: gameType,
        session_data: settings,
        difficulty_level: difficultyLevel,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Session creation error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Session created successfully:", session.id)
    return NextResponse.json({ session })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
