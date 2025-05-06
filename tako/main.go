package main

import (
	"log"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.POST("/logs", func(c *core.RequestEvent) error {
			// Define expected JSON body
			var body struct {
				Level   string         `json:"level"`
				Message string         `json:"message"`
				Data    map[string]any `json:"data"`
			}

			if err := c.BindBody(&body); err != nil {
				return c.BadRequestError("Invalid request body", err)
			}

			// Validate inputs
			if body.Message == "" {
				return c.BadRequestError("Message cannot be empty", nil)
			}

			// Convert 'Data' map to key-value pairs
			var kvPairs []any
			for k, v := range body.Data {
				kvPairs = append(kvPairs, k, v)
			}

			// Log based on level
			switch body.Level {
			case "warn":
				app.Logger().Warn(body.Message, kvPairs...)
			case "error":
				app.Logger().Error(body.Message, kvPairs...)
			case "info":
				app.Logger().Info(body.Message, kvPairs...)
			case "debug":
			default:
				app.Logger().Debug(body.Message, kvPairs...)
			}

			return c.JSON(http.StatusOK, fiber.Map{
				"level":   body.Level,
				"message": body.Message,
				"data":    body.Data,
			})
		})

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
