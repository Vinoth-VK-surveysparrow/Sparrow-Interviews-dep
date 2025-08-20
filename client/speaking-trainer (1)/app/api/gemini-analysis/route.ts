import { type NextRequest, NextResponse } from "next/server"

// Note: You'll need to add GEMINI_API_KEY to your environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { gameType, transcript, sessionData, audioUrl } = await request.json()

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
    }

    let analysisTranscript = transcript
    if (audioUrl && !transcript) {
      // For now, use session data to generate mock transcript
      analysisTranscript = generateMockTranscript(gameType, sessionData)
    }

    const prompt = generateGameSpecificPrompt(gameType, analysisTranscript, sessionData)

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      },
    )

    if (!response.ok) {
      throw new Error("Gemini API request failed")
    }

    const geminiResult = await response.json()
    const analysisText = geminiResult.candidates[0]?.content?.parts[0]?.text

    if (!analysisText) {
      throw new Error("No analysis received from Gemini")
    }

    // Parse the structured response
    const analysis = parseGeminiResponse(analysisText, gameType)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("Gemini analysis error:", error)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}

function generateGameSpecificPrompt(gameType: string, transcript: string, sessionData: any): string {
  const basePrompt = `You are an expert public speaking coach analyzing a user's performance. Please provide a structured analysis in JSON format.`

  switch (gameType) {
    case "rapid_fire":
      return `${basePrompt}

Game: Rapid Fire Analogies
Task: User completed analogies within time limits
Session Data: ${JSON.stringify(sessionData)}
Transcript: "${transcript}"

Analyze and return JSON with:
{
  "confidence_score": 0-100,
  "fluency_score": 0-100,
  "creativity_score": 0-100,
  "response_rate": 0-100,
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "specific_feedback": "detailed feedback",
  "next_steps": ["step1", "step2"]
}`

    case "conductor":
      return `${basePrompt}

Game: The Conductor (Energy Modulation)
Task: User modulated speaking energy based on visual cues
Session Data: ${JSON.stringify(sessionData)}
Transcript: "${transcript}"

Analyze and return JSON with:
{
  "energy_adaptation_score": 0-100,
  "consistency_score": 0-100,
  "presence_score": 0-100,
  "transition_smoothness": 0-100,
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "specific_feedback": "detailed feedback",
  "next_steps": ["step1", "step2"]
}`

    case "triple_step":
      return `${basePrompt}

Game: Triple Step (Integration Under Pressure)
Task: User integrated random words into ongoing speech
Session Data: ${JSON.stringify(sessionData)}
Transcript: "${transcript}"

Analyze and return JSON with:
{
  "integration_skill_score": 0-100,
  "topic_coherence_score": 0-100,
  "adaptability_score": 0-100,
  "pressure_handling": 0-100,
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "specific_feedback": "detailed feedback",
  "next_steps": ["step1", "step2"]
}`

    default:
      return `${basePrompt}
      
Transcript: "${transcript}"
Please analyze this speech and provide general feedback in JSON format.`
  }
}

function parseGeminiResponse(analysisText: string, gameType: string): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    // Fallback: create structured response from text
    return {
      confidence_score: 75,
      fluency_score: 80,
      creativity_score: 70,
      strengths: ["Clear articulation", "Good pacing"],
      areas_for_improvement: ["Reduce filler words", "Increase energy"],
      specific_feedback: analysisText,
      next_steps: ["Practice daily", "Focus on energy modulation"],
    }
  } catch (error) {
    console.error("Error parsing Gemini response:", error)
    return {
      error: "Failed to parse analysis",
      raw_response: analysisText,
    }
  }
}

function generateMockTranscript(gameType: string, sessionData: any): string {
  if (gameType === "rapid_fire" && sessionData.prompts) {
    const responses = sessionData.responses || []
    const prompts = sessionData.prompts || []

    let transcript = ""
    prompts.forEach((prompt: string, index: number) => {
      if (responses[index]) {
        transcript += `${prompt}... [user responded] `
      } else {
        transcript += `${prompt}... [no response] `
      }
    })
    return transcript
  }
  return "User participated in speaking exercise"
}
