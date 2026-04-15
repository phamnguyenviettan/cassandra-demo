package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"todo-app/db"
	"todo-app/services"

	"github.com/gocql/gocql"
	"github.com/joho/godotenv"
)

// formatVectorForCQL converts a float32 slice to CQL vector literal
func formatVectorForCQL(v []float32) string {
	parts := make([]string, len(v))
	for i, val := range v {
		parts[i] = fmt.Sprintf("%f", val)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func main() {
	// 1. Load env
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment variables")
	} else {
		log.Println("✅ Loaded .env file")
	}

	// 2. Connect DB
	cassHost := os.Getenv("CASSANDRA_HOST")
	if cassHost == "" {
		cassHost = "localhost"
	}

	// Use Connect directly from db package which sets up keyspace 'todo_app'
	if err := db.Connect(cassHost, 9042); err != nil {
		log.Fatalf("❌ Failed to connect to Cassandra: %v", err)
	}
	defer db.Close()
	log.Println("✅ Connected to Cassandra (todo_app)")

	// 3. Init AI Client
	aiClient := services.NewOpenRouterClient()

	// 4. Fetch all todo_embeddings to check for empty/zero vectors
	// We select ID, TodoID, Title, and Embedding
	log.Println("🔍 Scanning for broken embeddings (dim[0] or empty)...")

	type EmbRow struct {
		ID        gocql.UUID
		TodoID    gocql.UUID
		Title     string
		Embedding []float32
	}

	var brokenRows []EmbRow
	
	// Query to fetch all embeddings as JSON to avoid gocql VectorType issues
	iter := db.Session.Query(`SELECT id, todo_id, title, toJson(embedding) FROM todo_embeddings`).Iter()
	
	var id, todoID gocql.UUID
	var title, embeddingJson string
	
	count := 0
	
	for iter.Scan(&id, &todoID, &title, &embeddingJson) {
		count++
		
		var embedding []float32
		// Parse the JSON array string into []float32
		// If parsing fails or is empty, it's considered broken
		parsed := true
		if err := json.Unmarshal([]byte(embeddingJson), &embedding); err != nil {
			log.Printf("⚠️  Failed to parse embedding JSON for %s: %v", title, err)
			parsed = false
		}
		
		// Log every row to prove to the user what is in the DB
		log.Printf("ℹ️  Row %s: Found embedding with %d dims", title, len(embedding))

		isBroken := false
		if !parsed || len(embedding) == 0 {
			isBroken = true
		}

		if isBroken {
			log.Printf("⚠️  Found broken embedding: %s (ID: %s) -> Dims: %d (JSON len: %d)", title, id, len(embedding), len(embeddingJson))
			brokenRows = append(brokenRows, EmbRow{
				ID:        id,
				TodoID:    todoID,
				Title:     title,
				Embedding: embedding,
			})
		}
	}
	
	if err := iter.Close(); err != nil {
		log.Printf("⚠️  Error closing iterator: %v", err)
	}

	log.Printf("📊 Total scanned: %d, Broken found: %d", count, len(brokenRows))

	if len(brokenRows) == 0 {
		log.Println("✅ No broken embeddings found. Exiting.")
		return
	}

	// 5. Fix broken rows
	log.Println("🛠️  Starting repair process...")
	
	for _, row := range brokenRows {
		log.Printf("🔄 Repairing: %s ...", row.Title)
		
		// 5a. Double check if we have the full text content. 
		// The embedding table has 'Title', checking if we need Description from todos table
		var fullTitle, description string
		err := db.Session.Query(`SELECT title, description FROM todos WHERE id = ?`, row.TodoID).Scan(&fullTitle, &description)
		if err != nil {
			log.Printf("   ❌ Could not find original todo %s: %v. Deleting orphan embedding...", row.TodoID, err)
			// Optional: Delete the bad embedding if source todo is missing
			if err := db.Session.Query(`DELETE FROM todo_embeddings WHERE id = ?`, row.ID).Exec(); err != nil {
				log.Printf("      ❌ Failed to delete orphan: %v", err)
			} else {
				log.Printf("      🗑️  Deleted orphan embedding.")
			}
			continue
		}

		textToEmbed := fullTitle
		if description != "" {
			textToEmbed = fullTitle + ". " + description
		}

		// 5b. Generate new embedding
		newEmb, err := aiClient.GenerateEmbedding(textToEmbed)
		if err != nil {
			log.Printf("   ❌ Failed to generate embedding: %v", err)
			continue
		}

		// 5c. Update DB
		// Note: CREATE TABLE todo_embeddings (id, todo_id, title, embedding, created_at)
		// We can just UPDATE the embedding column or INSERT (overwrite)
		
		// Since we have the ID, we can update specific row
		vectorStr := formatVectorForCQL(newEmb)
		
		// To be safe, we use INSERT to overwrite everything ensuring consistency
		err = db.Session.Query(
			fmt.Sprintf(`UPDATE todo_embeddings SET embedding = %s, created_at = ? WHERE id = ?`, vectorStr),
			time.Now(), row.ID,
		).Exec()
		
		if err != nil {
			log.Printf("   ❌ Failed to update embedding in DB: %v", err)
		} else {
			log.Printf("   ✅ Repaired! New dims: %d", len(newEmb))
		}
		
		// Sleep briefly to avoid rate limits if many
		time.Sleep(200 * time.Millisecond)
	}
	
	log.Println("✨ Repair complete.")
}
