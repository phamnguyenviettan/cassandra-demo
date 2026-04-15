package main

import (
	"log"
	"os"

	"todo-app/db"
	"todo-app/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment variables")
	} else {
		log.Println("✅ Loaded .env file")
	}

	// Cassandra connection
	cassHost := os.Getenv("CASSANDRA_HOST")
	if cassHost == "" {
		cassHost = "localhost"
	}

	if err := db.Connect(cassHost, 9042); err != nil {
		log.Fatalf("❌ Failed to connect to Cassandra: %v", err)
	}
	defer db.Close()

	if err := db.InitSchema(); err != nil {
		log.Fatalf("❌ Failed to initialize schema: %v", err)
	}

	// Initialize AI client
	handlers.InitAIClient()

	// Gin router
	r := gin.Default()

	// CORS
	config := cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}
	// Note: AllowCredentials: true and AllowAllOrigins: true can conflict in some Gin versions if true and true are used.
	// Since we are not strictly authenticating cookies, let's just allow all without credentials.
	config.AllowCredentials = false
	r.Use(cors.New(config))

	api := r.Group("/api")

	// ── Todo routes ──────────────────────────────────────────────────────────
	api.GET("/todos", handlers.GetTodos)
	api.POST("/todos", handlers.CreateTodo)
	api.PATCH("/todos/:id/status", handlers.UpdateTodoStatus)
	api.DELETE("/todos/:id", handlers.DeleteTodo)
	api.GET("/todos/search", handlers.SearchTodos)
	api.GET("/todos/:id/history", handlers.GetTodoHistory)

	// ── Messages routes (NoSQL Time-Series) ─────────────────────────────────
	api.POST("/messages", handlers.SendMessage)
	api.GET("/messages/rooms", handlers.GetRooms)
	api.GET("/messages/:room_id", handlers.GetMessages)
	api.GET("/messages/:room_id/search", handlers.SearchMessages)
	api.POST("/messages/concurrent", handlers.ConcurrentWriteTest)

	// ── Scale & Cluster routes ───────────────────────────────────────────────
	api.GET("/scale/status", handlers.GetScaleStatus)
	api.POST("/scale/benchmark", handlers.RunBenchmark)
	api.GET("/scale/consistency-demo", handlers.ConsistencyDemo)
	api.GET("/scale/ha-test", handlers.HATest)

	// ── Demo / Global Scale routes ────────────────────────────────────────────
	demo := api.Group("/demo")
	{
		demo.POST("/telemetry/stream", handlers.StreamTelemetry)
		demo.GET("/telemetry/:user_id", handlers.GetTelemetry)
		demo.POST("/todos/smart", handlers.CreateSmartTodo)
		demo.PATCH("/todos/:id/attributes", handlers.UpdateTodoAttributes)
		demo.GET("/cluster/status", handlers.GetClusterStatus)
		demo.GET("/stats", handlers.GetStats)
	}

	// ── AI routes ─────────────────────────────────────────────────────────────
	ai := api.Group("/ai")
	{
		ai.POST("/generate", handlers.GenerateTask)
		ai.POST("/embed/:id", handlers.EmbedTodo)
		ai.POST("/embed-all", handlers.EmbedAllTodos)
		ai.POST("/search", handlers.VectorSearch)
		ai.GET("/compare", handlers.CompareSearch)
	}

	// ── System routes ─────────────────────────────────────────────────────────
	api.GET("/database", handlers.GetDatabaseInfo)
	api.GET("/performance/stress-write", handlers.StressWriteTest)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on :%s", port)
	log.Printf("📡 Routes: /api/messages, /api/scale, /api/demo, /api/ai")
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
