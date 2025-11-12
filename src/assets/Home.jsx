import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import "../App.css";
import Sidebar from "./components/Sidebar";
import SearchChats from "./components/SearchChats";

function Home() {
  const apiUrl = import.meta.env.VITE_API_URL;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(null);
  const [question, setQuestion] = useState("");
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeChatName, setActiveChatName] = useState("");
  const [canSubmit, setCanSubmit] = useState(true);
  const [isSearch, setIsSearch] = useState(false);
  const [chats, setChats] = useState([]);
  const [isFormFocused, setIsFormFocused] = useState(false);

  const handleTextareaInput = (e) => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
    setQuestion(textarea.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canSubmit) return;
    const currentQuestion = question.trim();
    if (!currentQuestion) return;

    setQuestion("");
    const textarea = document.getElementById("prompt");
    if (textarea) textarea.style.height = "20px";

    const newIndex = replies.length;
    setActiveQuestionIndex(newIndex);

    if (replies.length === 0) {
      setActiveChatName("");
    }

    setReplies((prev) => [...prev, { role: "user", content: currentQuestion }, { role: "assistant", content: "" }]);
    setActiveChatName(true);
    setCanSubmit(false);
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: currentQuestion }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullAnswer += chunk;

        setReplies((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullAnswer;
          return updated;
        });
        setLoading(false);
      }

      const updatedReplies = [...replies, { role: "user", content: currentQuestion }, { role: "assistant", content: fullAnswer }];
      setReplies(updatedReplies);

      if (activeChatName === "") {
        const res = await fetch(`${apiUrl}/api/add-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            question: question,
            replies: updatedReplies,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveChatName(data.chat_name);
        }
      }

      const res = await fetch(`${apiUrl}/api/update-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          chat_id: activeChatName,
          replies: updatedReplies,
        }),
      });
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setCanSubmit(true);
    }
  };

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const res = await fetch(`${apiUrl}/verify`, {
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json();

          if (data.error === "Token expired") {
            const refreshRes = await fetch(`${apiUrl}/refresh`, {
              credentials: "include",
            });
            const refreshData = await refreshRes.json();

            if (refreshData.access_token) {
              const retryRes = await fetch(`${apiUrl}/verify`, {
                credentials: "include",
              });
              if (retryRes.ok) {
                const userData = await retryRes.json();
                setIsLoggedIn(true);
                setUser(userData);
              } else {
                setIsLoggedIn(false);
                window.location.href = "/login-expired";
              }
            } else {
              setIsLoggedIn(false);
              window.location.href = "/login-expired";
            }
          } else {
            setIsLoggedIn(false);
          }
          return;
        }
        const data = await res.json();
        setIsLoggedIn(true);
        setUser(data);

        const response = await fetch(`${apiUrl}/api/get-chats`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: data.email,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setChats(data.chats);
        }
      } catch (err) {
        console.error(err);
      }
    };

    verifyUser();
  }, []);

  return (
    <div>
      <Navbar isLoggedIn={isLoggedIn} email={isLoggedIn ? user.email : ""} setUser={setUser} setIsLoggedIn={setIsLoggedIn} />
      {isLoggedIn && (
        <Sidebar
          chats={chats}
          setChats={setChats}
          setActiveChat={setActiveChatName}
          activeChat={activeChatName}
          setReplies={setReplies}
          email={user.email}
          setIsSearch={setIsSearch}
        />
      )}
      {activeChatName && replies.length > 0 ? (
        <div className="app-container">
          <div className="chat-container">
            <div className="replies-container">
              {replies.map((reply, index) =>
                reply.role === "user" ? (
                  <div key={index} className="question-loading-container">
                    <div className="question-chat-container">
                      <div key={index} className="question-chat-background">
                        <p className="question-text">{reply.content}</p>
                      </div>
                    </div>
                    {loading && index == activeQuestionIndex && (
                      <div key={index} role="status">
                        <svg
                          aria-hidden="true"
                          className="inline w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-gray-300"
                          viewBox="0 0 100 101"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                            fill="currentColor"
                          />
                          <path
                            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                            fill="currentFill"
                          />
                        </svg>
                        <span className="sr-only">Loading...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div key={index} className="reply-chat-container">
                    <p className="chat-text">{reply.content}</p>
                  </div>
                )
              )}
            </div>
          </div>
          <div className="form-container-chat">
            <form
              className={`input-prompt ${isFormFocused ? "input-first-prompt-focused" : ""}`}
              onSubmit={handleSubmit}
              onFocus={() => setIsFormFocused(true)}
              onBlur={() => setIsFormFocused(false)}
            >
              <button>
                <img src="/plus.svg" alt="Plus icon" className="icon" />
              </button>
              <textarea
                id="prompt"
                placeholder="Enter your (maybe fake) truth here"
                value={question}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                onChange={handleTextareaInput}
                rows={1}
                style={{
                  resize: "none",
                  lineHeight: "20px",
                  overflowY: "auto",
                  height: "20px",
                  maxHeight: "6em",
                }}
              />
            </form>
            <p className="disclaimer-text">FakeOrReal can make mistakes. Check important info. See Cookie Preferences</p>
          </div>
        </div>
      ) : (
        <div className="background">
          <div className="prompt-container">
            <h1 className="h1-chat">What do you want busted today?</h1>
            <form
              className={`input-first-prompt ${isFormFocused ? "input-first-prompt-focused" : ""}`}
              onSubmit={handleSubmit}
              onFocus={() => setIsFormFocused(true)}
              onBlur={() => setIsFormFocused(false)}
            >
              <button>
                <img src="/plus.svg" alt="Plus icon" className="icon" />
              </button>
              <textarea
                id="prompt"
                placeholder="Enter your (maybe fake) truth here"
                value={question}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();

                    if (!canSubmit) return;

                    handleSubmit(e);
                  }
                }}
                onChange={handleTextareaInput}
                rows={1}
                style={{
                  resize: "none",
                  lineHeight: "20px",
                  overflowY: "auto",
                  minHeight: "20px",
                  maxHeight: "6em",
                }}
              />
            </form>
          </div>
        </div>
      )}
      {isSearch && <SearchChats setIsSearch={setIsSearch} setActiveChat={setActiveChatName} setReplies={setReplies} email={user.email} />}
    </div>
  );
}

export default Home;
