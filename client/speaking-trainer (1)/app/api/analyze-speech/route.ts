import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] API: Received analyze-speech request")

    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const gameDataStr = formData.get("gameData") as string

    if (!audioFile || !gameDataStr) {
      console.log("[v0] API: Missing audio file or game data")
      return Response.json({ error: "Missing audio file or game data" }, { status: 400 })
    }

    const gameData = JSON.parse(gameDataStr)
    console.log("[v0] API: Processing audio file size:", audioFile.size)
    console.log("[v0] API: Audio MIME type:", audioFile.type)
    console.log("[v0] API: Game data:", gameData)

    const supportedTypes = ["audio/ogg", "audio/mp3", "audio/mpeg", "audio/webm"]
    if (!supportedTypes.some((type) => audioFile.type.includes(type))) {
      console.log("[v0] API: Unsupported audio format for Gemini:", audioFile.type)
      return Response.json(
        {
          error: "Unsupported audio format",
          details: `Gemini requires audio/ogg, audio/mp3, or audio/webm, got ${audioFile.type}`,
        },
        { status: 400 },
      )
    }

    // Convert audio file to base64 for Gemini
    const audioBuffer = await audioFile.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString("base64")

    let geminiMimeType = audioFile.type
    if (audioFile.type.includes("webm")) {
      geminiMimeType = "audio/ogg"
      console.log("[v0] API: Converting webm to ogg MIME type for Gemini")
    }

    console.log("[v0] API: Calling Gemini API")

    const generateGamePrompt = (gameData: any) => {
      const gameType = gameData.gameType || "rapid-fire"

      if (gameType === "conductor") {
        return `THE CONDUCTOR GAME ANALYSIS - Energy Modulation Training

GAME OVERVIEW: This is an energy modulation exercise where the user speaks about a topic while adapting their vocal energy to match changing conductor cues.

GAME DATA:
- Topic: "${gameData.topic}"
- Duration: ${gameData.duration} seconds
- Energy Changes: ${gameData.totalChanges} cues
- Breathe Recoveries: ${gameData.breatheRecoveries}

ENERGY LEVELS USED:
${
  gameData.energyChanges
    ?.map(
      (change: any, index: number) =>
        `${index + 1}. ${change.type === "energy" ? `Energy Level ${change.level}` : "BREATHE cue"} at ${Math.round(change.timestamp / 1000)}s`,
    )
    .join("\n") || "No energy changes recorded"
}

EVALUATION CRITERIA:
1. **Energy Adaptation**: How well did they match vocal energy to the conductor's cues?
2. **Vocal Range**: Did they demonstrate variety in volume, pace, and intensity?
3. **Topic Coherence**: Did they maintain their message while changing energy?
4. **Recovery Skills**: How did they handle BREATHE cues for reset moments?

REQUIRED JSON OUTPUT:
{
  "confidence_score": "0-100 based on energy adaptation and vocal control",
  "specific_feedback": "Analysis of energy modulation skills and vocal variety",
  "next_steps": ["specific suggestions for improving energy control and presence"]
}`
      }

      if (gameType === "triple-step") {
        const wordsList =
          gameData.wordDrops
            ?.map(
              (drop: any, index: number) =>
                `${index + 1}. "${drop.word}" (${drop.integrated ? "integrated" : "missed"})`,
            )
            .join("\n") || "No words recorded"

        return `TRIPLE STEP GAME ANALYSIS - Integration Under Pressure

GAME OVERVIEW: This is an integration exercise where the user speaks about a main topic while seamlessly weaving in random words that appear on screen.

GAME DATA:
- Main Topic: "${gameData.mainTopic}"
- Total Words: ${gameData.totalWords}
- Integration Time: ${gameData.integrationTime} seconds per word

WORDS PRESENTED:
${wordsList}

EVALUATION CRITERIA:
1. **Integration Success**: How smoothly did they weave random words into their speech?
2. **Topic Coherence**: Did they maintain focus on the main topic despite distractions?
3. **Adaptation Speed**: How quickly did they integrate each word?
4. **Natural Flow**: Did integrations feel organic or forced?

REQUIRED JSON OUTPUT:
{
  "confidence_score": "0-100 based on integration skills and adaptability",
  "specific_feedback": "Analysis of word integration and focus under pressure",
  "next_steps": ["specific suggestions for improving integration and adaptability skills"]
}`
      }

      // Default to rapid-fire
      const promptsList = gameData.prompts || []
      const promptsText =
        promptsList.length > 0
          ? promptsList.map((prompt: string, index: number) => `${index + 1}. "${prompt}"`).join("\n")
          : "No specific prompts recorded"

      return `RAPID FIRE ANALOGIES GAME ANALYSIS

CRITICAL INSTRUCTIONS: This is a confidence-building exercise. Your evaluation must focus ONLY on response rate, speed, and vocal confidence - NOT the quality, logic, or creativity of analogies.

ANALOGIES PRESENTED TO USER:
${promptsText}

GAME SETTINGS:
- Total Prompts: ${gameData.totalPrompts || 5}
- Time Per Prompt: ${gameData.settings?.timePerPrompt || 1} seconds
- Total Game Duration: ${(gameData.totalPrompts || 5) * (gameData.settings?.timePerPrompt || 1)} seconds

EVALUATION CRITERIA (STRICT ADHERENCE REQUIRED):
1. **PRIMARY METRIC - Response Rate**: Did they speak ANYTHING (even "um", "uh", partial words) vs complete silence?
   - ANY vocalization = RESPONSE (even if incomplete)
   - Complete silence = NO RESPONSE
   - Score based on: (Number of prompts with ANY vocalization / Total prompts) × 100

2. **SECONDARY METRIC - Speed**: How quickly did they start speaking after each prompt?
   - Immediate response (0-0.5s) = Excellent
   - Quick response (0.5-1s) = Good  
   - Delayed response (1s+) = Needs improvement

3. **BONUS METRIC - Confidence**: Voice energy, hesitation patterns, vocal strength
   - Strong, clear voice = High confidence
   - Hesitant, quiet, lots of "um/uh" = Lower confidence

4. **EXPLICITLY NOT EVALUATED**: Content quality, logic, creativity, "correctness" of analogies

TRANSCRIPTION REQUIREMENTS:
- Listen to the ENTIRE audio recording
- Identify each analogy prompt timing
- Transcribe EXACTLY what the user said for each prompt (including partial attempts, filler words)
- If user was completely silent for a prompt, mark as "[SILENT]"
- Show the original prompt alongside their response

REQUIRED JSON OUTPUT FORMAT:
{
  "detailed_analysis": {
    "prompt_1": {
      "original_prompt": "exact analogy prompt presented",
      "user_response": "exact transcription of what they said OR [SILENT]",
      "response_detected": true/false,
      "response_speed": "immediate/quick/delayed/none"
    },
    "prompt_2": { ... },
    "prompt_3": { ... },
    "prompt_4": { ... },
    "prompt_5": { ... }
  },
  "scoring_summary": {
    "total_prompts": ${gameData.totalPrompts || 5},
    "prompts_with_responses": "number of prompts where user spoke anything",
    "prompts_silent": "number of prompts with complete silence",
    "actual_response_rate": "percentage (prompts_with_responses/total_prompts * 100)"
  },
  "confidence_score": "0-100 based on vocal energy and hesitation patterns",
  "specific_feedback": "Focus on response rate achievement and vocal confidence, acknowledge any responses made",
  "next_steps": ["specific actionable suggestions for improving response rate and confidence"]
}`
    }

    const gamePrompt = generateGamePrompt(gameData)

    const callGeminiWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[v0] API: Gemini API attempt ${attempt}/${maxRetries}`)

        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: gamePrompt + "\n\nANALYZE THE AUDIO NOW:",
                      },
                      {
                        inlineData: {
                          mimeType: geminiMimeType,
                          data: audioBase64,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 2000,
                },
              }),
            },
          )

          console.log(`[v0] API: Gemini response status: ${geminiResponse.status}`)
          console.log(`[v0] API: Gemini response headers:`, Object.fromEntries(geminiResponse.headers.entries()))

          // Get response as text first to see what we're actually getting
          const responseText = await geminiResponse.text()
          console.log(`[v0] API: Gemini raw response (first 500 chars):`, responseText.substring(0, 500))
          console.log(`[v0] API: Gemini response length:`, responseText.length)

          if (geminiResponse.ok) {
            // Try to parse as JSON
            let geminiData
            try {
              geminiData = JSON.parse(responseText)
              console.log("[v0] API: Successfully parsed Gemini JSON response")
            } catch (parseError) {
              console.log("[v0] API: Failed to parse Gemini response as JSON:", parseError.message)
              console.log("[v0] API: Response starts with:", responseText.substring(0, 100))
              throw new Error(`Gemini returned non-JSON response: ${responseText.substring(0, 200)}`)
            }

            if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
              console.log("[v0] API: Invalid Gemini response structure:", geminiData)
              throw new Error("Invalid Gemini response structure")
            }

            const analysisText = geminiData.candidates[0].content.parts[0].text
            console.log("[v0] API: Analysis text:", analysisText)

            // Parse JSON from Gemini response
            let analysis
            try {
              // First try to parse the entire response as JSON
              analysis = JSON.parse(analysisText)
            } catch (firstError) {
              console.log("[v0] API: First JSON parse failed, trying to extract JSON from text")

              // If that fails, try to extract JSON from the text using multiple patterns
              let jsonMatch = analysisText.match(/\{[\s\S]*\}/)

              // If no JSON block found, try looking for JSON after common prefixes
              if (!jsonMatch) {
                const patterns = [
                  /```json\s*(\{[\s\S]*?\})\s*```/,
                  /```\s*(\{[\s\S]*?\})\s*```/,
                  /(?:Here's|Here is).*?(\{[\s\S]*\})/i,
                  /(?:Analysis|Result).*?(\{[\s\S]*\})/i,
                ]

                for (const pattern of patterns) {
                  const match = analysisText.match(pattern)
                  if (match) {
                    jsonMatch = [match[1]]
                    break
                  }
                }
              }

              if (!jsonMatch) {
                console.log("[v0] API: No JSON found in Gemini response, raw text:", analysisText.substring(0, 500))

                return Response.json({
                  confidence_score: 50,
                  specific_feedback:
                    "AI analysis encountered a formatting issue. The audio was processed but detailed analysis is unavailable. Please try again.",
                  next_steps: [
                    "Try the exercise again for detailed feedback",
                    "Continue practicing to build confidence",
                  ],
                  raw_response: analysisText.substring(0, 200),
                })
              }

              try {
                // Clean up the JSON string before parsing
                let jsonString = jsonMatch[0].trim()

                // Remove any trailing text after the closing brace
                const lastBraceIndex = jsonString.lastIndexOf("}")
                if (lastBraceIndex !== -1) {
                  jsonString = jsonString.substring(0, lastBraceIndex + 1)
                }

                analysis = JSON.parse(jsonString)
              } catch (secondError) {
                console.log("[v0] API: Failed to parse extracted JSON:", jsonMatch[0].substring(0, 200))
                console.log("[v0] API: Parse error:", secondError.message)

                return Response.json({
                  confidence_score: 50,
                  specific_feedback:
                    "AI analysis completed but encountered a formatting issue. Your speech was recorded and processed successfully.",
                  next_steps: [
                    "Try the exercise again for detailed feedback",
                    "Continue practicing to improve your skills",
                  ],
                  parse_error: secondError.message,
                  raw_response: analysisText.substring(0, 200),
                })
              }
            }

            console.log("[v0] API: Parsed analysis:", analysis)

            const sanitizedAnalysis = {
              confidence_score: analysis.confidence_score || analysis.scoring_summary?.actual_response_rate || 50,
              specific_feedback: analysis.specific_feedback || "Keep practicing to improve your speaking skills!",
              next_steps: analysis.next_steps || ["Continue practicing", "Focus on building confidence"],
              detailed_analysis: analysis.detailed_analysis || null,
              scoring_summary: analysis.scoring_summary || null,
            }

            return Response.json(sanitizedAnalysis)
          }

          console.log(`[v0] API: Gemini API error on attempt ${attempt}:`, responseText)

          // Parse error to check if it's a 503 overload error
          let isOverloadError = false
          try {
            const errorData = JSON.parse(responseText)
            isOverloadError = errorData.error?.code === 503 || errorData.error?.status === "UNAVAILABLE"
          } catch {
            isOverloadError = responseText.includes("overloaded") || responseText.includes("503")
          }

          // If it's an overload error and we have retries left, wait and retry
          if (isOverloadError && attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000 // Exponential backoff: 2s, 4s, 8s
            console.log(`[v0] API: Gemini overloaded, waiting ${waitTime}ms before retry ${attempt + 1}`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            continue
          }

          // If not an overload error or no retries left, throw the error
          throw new Error(`Gemini API error (${geminiResponse.status}): ${responseText}`)
        } catch (fetchError) {
          console.log(`[v0] API: Fetch error on attempt ${attempt}:`, fetchError.message)
          if (attempt === maxRetries) {
            throw fetchError
          }
          console.log(`[v0] API: Network error on attempt ${attempt}, retrying...`)
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    const result = await callGeminiWithRetry()
    return result
  } catch (error) {
    console.error("[v0] API: Error:", error)
    return Response.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
