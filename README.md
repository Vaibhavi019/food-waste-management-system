# SANCHARI
**Smart Food. Smarter Redistribution.**

Current AI, computer vision, IoT, logistics, and utilization modules are prototype implementations designed for demonstration and future production integration.

## 1. SANCHARI Overview
SANCHARI is an AI-powered smart food waste reduction and sustainable redistribution ecosystem designed to connect institutional kitchens, food-processing units, and verified community recipients. It creates a coherent end-to-end flow from demand prediction to sustainable impact tracking.

## 2. SIH Problem Statement ID 26234
AI-Powered Smart Food Waste Reduction and Sustainable Redistribution Ecosystem for Institutional Kitchens and Food Processing Units.

## 3. Problem Statement
Food surplus in institutional and processing contexts is difficult to predict, assess, match, redistribute, and measure. Without a unified ecosystem, excess food becomes landfill waste instead of reaching communities in need or secondary upcycling markets.

## 4. Solution
SANCHARI solves this by integrating:
- Demand forecasting and surplus detection to intercept waste at the source.
- Simulated IoT and AI-assisted visual screening to ensure food safety.
- Intelligent matching and logistics to route food to the most optimal destination.
- Traceability and transparent sustainability analytics to measure impact without fabricating data.

## 5. Architecture
SANCHARI uses a monolithic, server-side rendered Model-View-Controller (MVC) architecture. The backend securely isolates roles (Donors, Receivers, Admins) and implements local service modules for each step of the lifecycle.

## 6. Technology Stack
- **Backend:** Node.js, Express
- **Frontend:** EJS (Server-Side Rendering), Vanilla CSS, Vanilla JavaScript
- **Database:** MongoDB, Mongoose
- **Security:** bcryptjs, express-session

## 7. Modules
- **Demand Forecasting:** Historical consumption-based heuristics.
- **IoT Telemetry:** Simulated temperature/humidity storage tracking.
- **Vision Quality-Risk:** Prototype hashing-based anomaly detection.
- **Matching:** Recipient compatibility scoring based on capacity and distance.
- **Logistics:** Prototype ETA and urgency evaluation.
- **Processing:** Rule-based decision support for redistribution vs. upcycling vs. recovery.
- **Traceability:** Hash-linked event ledger.
- **Sustainability:** Transparent metrics aggregation.

## 8. AI Methodology
Explainable AI (XAI) heuristics. Forecasting relies on a deterministic rule-based prototype rather than a black-box deep learning model. It evaluates recent production, historical averages, and waste margins to calculate confidence and recommend production limits.

## 9. IoT Methodology
The project currently implements simulated prototype IoT telemetry. It safely models normal, warning, and critical temperature/humidity bands. It does not require physical hardware or live MQTT infrastructure for the demonstration.

## 10. Computer Vision Limitations
The current visual analysis is an AI-assisted prototype assessment using a deterministic hash of the image buffer, not a trained food-spoilage classifier. It requires human verification before any redistribution decisions are made.

## 11. Matching Methodology
Intelligent matching operates as an explainable, rule-based prototype. It scores recipients out of 100 based on matching categories, recipient capacity, relative distance (Haversine formula), and remaining usable time.

## 12. Logistics Methodology
Logistics provides an estimated travel-time model and pickup feasibility check. It is not live traffic routing or real-time GPS optimization. It calculates ETA assuming standard transit speeds based on Haversine distance and checks it against food expiry time.

## 13. Processing / Upcycling Methodology
Decision support uses heuristics (category, remaining time, matching results) to recommend REDISTRIBUTE, PROCESS_UPCYCLE, or ORGANIC_RECOVERY. It does not automatically dispose of food, declare it safe, or automatically certify it for human consumption. Human review is required.

## 14. Traceability Methodology
A tamper-evident hash-linked digital audit trail. It records major lifecycle milestones (Creation, Matching, Logistics, OTP Verification, Handover, Utilization) using sequential SHA-256 integrity hashes. It is not a blockchain.

## 15. Sustainability Methodology
Calculates absolute RECORDED food diverted based strictly on completed handovers and confirmed utilization pathways, preventing double counting. Environmental indicators (like CO2e and Water) are deliberately categorized as ESTIMATED or UNAVAILABLE to avoid fabricating fake environmental impacts without validated conversion factors.

## 16. Security
- Password hashing (bcrypt)
- Strict role-based middleware
- ObjectId validation on all routes
- Complete separation of donor/recipient data
- Read-only analytics endpoints (no client-driven traceability events)

## 17. Testing
Comprehensive service-level unit tests validate business logic without relying on the database:
- `aiForecasting.test.js`
- `iotService.test.js`
- `visionService.test.js`
- `matchingService.test.js`
- `logisticsService.test.js`
- `processingService.test.js`
- `sustainabilityService.test.js`

## 18. Known Limitations
- Data accuracy depends heavily on truthful donor input.
- Missing an authoritative environmental factor database (e.g., Ecoinvent) limits the scope of automated ESG reporting.
- Current AI/Vision/IoT are structural prototypes ready for cloud API integration in a production environment.

## 19. Future Enhancements
- Integration with live MQTT broker for real sensor tracking.
- Swapping the vision hash prototype for a YOLO/TensorFlow image classification endpoint.
- Integrating Google Maps or Mapbox for true live traffic ETA.

## 20. Local Setup Instructions
```bash
npm install
npm start
```
By default, the application runs on `http://localhost:3000`. You will need a local MongoDB instance running, or you must provide a `MONGO_URI` environment variable connecting to MongoDB Atlas. Tests can be run directly using `node tests/<filename>.js`.
