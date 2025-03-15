import React, { useState, useEffect } from "react";
import "./DebtPop.css"; // Import external CSS file

const DebtPop = () => {
  const [debtAmount, setDebtAmount] = useState("");
  const [bank, setBank] = useState("");
  const [duration, setDuration] = useState("");
  const [totalPrice, setTotalPrice] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Updated bank percentages with fixed rates
  const bankPercentages = {
    kaspi_debt: 0.239, // Kaspi Кредит - 23.9%
    kaspi_deposit: 0.132, // Kaspi Депозит - 13.2%
    jusan_debt: 0.37, // Jusan Кредит - 37%
    jusan_deposit: 0.138, // Jusan Депозит - starts at 13.8% (will be adjusted based on duration)
  };

  // Bank display names for better readability
  const bankDisplayNames = {
    kaspi_debt: "Kaspi Кредит",
    kaspi_deposit: "Kaspi Депозит",
    jusan_debt: "Jusan Кредит",
    jusan_deposit: "Jusan Депозит",
  };

  // Handle debt amount change
  const handleDebtAmountChange = (e) => {
    setDebtAmount(e.target.value);
  };

  // Handle bank selection change
  const handleBankChange = (e) => {
    setBank(e.target.value);
  };

  // Handle duration change
  const handleDurationChange = (e) => {
    setDuration(e.target.value);
  };

  // Parse AI response to extract recommendations
  const parseRecommendations = (response) => {
    // Log the full response to console
    console.log("Full Deepseek Response:", response);

    // Look for numbered items (1. 2. 3.) or bullet points
    const regex = /(?:\d+\.\s*|\*\s*|-)(.+?)(?=\d+\.\s*|\*\s*|-|$)/gs;
    const matches = [...response.matchAll(regex)].map((match) =>
      match[1].trim()
    );

    // If regex didn't find numbered recommendations, split by newlines as fallback
    if (matches.length === 0) {
      const lineRecommendations = response
        .split("\n")
        .filter((line) => line.trim() !== "")
        .slice(0, 3);

      console.log("Parsed recommendations (by lines):", lineRecommendations);
      return lineRecommendations;
    }

    console.log("Parsed recommendations (by regex):", matches.slice(0, 3));
    return matches.slice(0, 3); // Return only the first 3 recommendations
  };

  // Calculate total price and expenses based on bank type
  const calculateFinancials = (debt, bankType, months) => {
    const S = debt;
    const n = months;
    let totalAmount = 0;
    let expensesAmount = 0;
    let rate = 0;

    // Get appropriate rate based on bank type and possibly duration
    if (bankType === "kaspi_debt") {
      rate = 0.239; // 23.9%
    } else if (bankType === "jusan_debt") {
      rate = 0.37; // 37%
    } else if (bankType === "kaspi_deposit") {
      rate = 0.132; // 13.2%
    } else if (bankType === "jusan_deposit") {
      // Adjust rate based on duration for Jusan Deposit
      if (n <= 3) {
        rate = 0.138; // 13.8%
      } else if (n <= 6) {
        rate = 0.137; // 13.7%
      } else {
        rate = 0.132; // 13.2%
      }
    } else {
      // For Kaspi Red or any other product
      rate = bankPercentages[bankType];
    }

    // For Kaspi Кредит and Jusan Кредит: ((S * r/12) / (1- (1+r/12)^-n)) * n
    if (bankType === "kaspi_debt" || bankType === "jusan_debt") {
      const monthlyRate = rate / 12;
      const denominator = 1 - Math.pow(1 + monthlyRate, -n);
      const monthlyPayment = (S * monthlyRate) / denominator;
      totalAmount = monthlyPayment * n;
      expensesAmount = totalAmount - S;
    }
    // For Kaspi Депозит: (debt amount * 13.2% * 30) / 360 * n
    else if (bankType === "kaspi_deposit") {
      const dailyInterest = (S * rate * 30) / 360;
      totalAmount = S + dailyInterest * n;
      expensesAmount = dailyInterest * n;
    }
    // For Jusan Депозит: (S * (1+r/12)^n) * n
    else if (bankType === "jusan_deposit") {
      const compoundedAmount = (S * (1 + rate / 12)) ^ n;
      totalAmount = compoundedAmount;
      expensesAmount = totalAmount - S;
    }
    // For other products (like Kaspi Red)
    else {
      const monthlyInterest = rate / 12;
      expensesAmount = S * monthlyInterest * n;
      totalAmount = S + expensesAmount;
    }

    return {
      totalPrice: totalAmount,
      expenses: expensesAmount,
    };
  };

  // Handle the "Done" button click
  const handleDoneClick = async (e) => {
    if (debtAmount && bank && duration) {
      e.preventDefault();
      setLoading(true);

      // Reset previous results
      setTotalPrice(null);
      setExpenses(null);
      setRecommendations([]);

      try {
        console.log("Sending request to Deepseek API...");

        // Get appropriate percentage for AI prompt
        let promptPercentage = bankPercentages[bank];

        // Adjust percentage for Jusan Deposit based on duration
        if (bank === "jusan_deposit") {
          const months = parseInt(duration);
          if (months <= 3) {
            promptPercentage = 0.138;
          } else if (months <= 6) {
            promptPercentage = 0.137;
          } else {
            promptPercentage = 0.132;
          }
        }

        const prompt = `Provide brief advice for someone with a ${debtAmount} debt at ${
          bankDisplayNames[bank]
        } with interest rate of ${
          promptPercentage * 100
        }% for a duration of ${duration} months. Give me the text that is just numerated. without extra text. The format is: 1. _______ 2. ______ 3. _____ `;

        console.log("Prompt sent to Deepseek:", prompt);

        const res = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer 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",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "deepseek/deepseek-r1:free",
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
            }),
          }
        );

        const data = await res.json();
        console.log("Full API response:", data);

        const aiResponse = data.choices[0].message.content;
        console.log("Deepseek message content:", aiResponse);

        const parsedRecommendations = parseRecommendations(aiResponse);
        setRecommendations(parsedRecommendations);
      } catch (error) {
        console.error("Error fetching AI response:", error);
        setRecommendations([
          "Не удалось получить рекомендации. Пожалуйста, попробуйте снова.",
          "Проверьте ваше интернет-соединение.",
          "Обратитесь в службу поддержки банка за консультацией.",
        ]);
      } finally {
        setLoading(false);
      }

      // Calculate debt information using the correct formulas
      const debt = parseFloat(debtAmount);
      const months = parseInt(duration);

      const { totalPrice: calculatedTotalPrice, expenses: calculatedExpenses } =
        calculateFinancials(debt, bank, months);

      setExpenses(calculatedExpenses);
      setTotalPrice(calculatedTotalPrice);
    }
  };

  return (
    <div className="layout-container">
      <div className="layout-content-container">
        {/* Banner Section */}
        <div
          className="banner"
          style={{
            backgroundImage: "url('/shapka.png')", // Adjust the path as needed
          }}
        ></div>

        {/* Title */}
        <h3>DebtPop</h3>

        {/* Debt Input */}
        <div className="input-container">
          <label>
            <p>Enter the debt amount</p>
            <input
              type="number"
              placeholder="100,000"
              value={debtAmount}
              onChange={handleDebtAmountChange}
            />
          </label>
        </div>

        {/* Bank Selection */}
        <div className="input-container">
          <label>
            <p>Select bank</p>
            <select value={bank} onChange={handleBankChange}>
              <option value="">Select an option</option>
              {Object.entries(bankDisplayNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Duration Input */}
        <div className="input-container">
          <label>
            <p>Enter duration (months)</p>
            <input
              type="number"
              placeholder="12"
              value={duration}
              onChange={handleDurationChange}
            />
          </label>
        </div>

        {/* Button Container */}
        <div className="button-container">
          <button
            onClick={handleDoneClick}
            disabled={
              !debtAmount ||
              isNaN(debtAmount) ||
              !bank ||
              !duration ||
              isNaN(duration) ||
              loading
            }
          >
            {loading ? "Calculating..." : "Done"}
          </button>
        </div>

        {/* Results Section - Only shown after calculation */}
        {totalPrice !== null && expenses !== null && (
          <div className="results-section">
            {/* Price Summary */}
            <div className="price-summary">
              <div>
                <p>Total final price</p>
                <p>{totalPrice.toLocaleString()} ₸</p>
              </div>
              <div>
                <p>Expenses</p>
                <p>{expenses.toLocaleString()} ₸</p>
              </div>
            </div>
          </div>
        )}

        {/* Hints Section */}
        <h3>Hints and Recommendations</h3>
        {loading ? (
          <div className="loading-recommendations">
            <p>Getting personalized recommendations...</p>
          </div>
        ) : (
          <div className="recommendations-container">
            {recommendations.length > 0
              ? recommendations.map((recommendation, index) => (
                  <div key={index} className="hint-container">
                    <div className="hint-icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24px"
                        height="24px"
                        fill="currentColor"
                        viewBox="0 0 256 256"
                      >
                        <path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Z" />
                      </svg>
                    </div>
                    <p className="hint-text">{recommendation}</p>
                  </div>
                ))
              : // Default recommendations when no AI recommendations are available yet
                [
                  "Pay off your debt as soon as possible",
                  "Try to negotiate with the bank for a better rate",
                  "If you have multiple debts, consider consolidating them",
                ].map((hint, index) => (
                  <div key={index} className="hint-container">
                    <div className="hint-icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24px"
                        height="24px"
                        fill="currentColor"
                        viewBox="0 0 256 256"
                      >
                        <path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Z" />
                      </svg>
                    </div>
                    <p className="hint-text">{hint}</p>
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtPop;
