import React, { useState, useEffect } from "react";

const SearchChats = ({ setIsSearch, setActiveChat, setReplies, email }) => {
  const apiUrl = import.meta.env.VITE_API_URL;

  const [searchedChats, setSearchedChats] = useState([]);
  const [chatsToday, setChatsToday] = useState([]);
  const [chatsLast7Days, setchatsLast7Days] = useState([]);
  const [isChatsLoading, setIsChatsLoading] = useState(false);

  const handleChatSearch = async (e) => {
    e.preventDefault();

    const search = e.target.value;

    try {
      const res = await fetch(`${apiUrl}/api/get-chats-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          search: search,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSearchedChats(data.chats);
      }
    } catch (err) {
      console.log("error: ", err);
    }
  };

  const handleCloseChatSearch = () => {
    setIsSearch(false);
  };

  useEffect(() => {
    const getPrevChats = async () => {
      setIsChatsLoading(true);

      try {
        const res = await fetch(`${apiUrl}/api/get-chats-today`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setChatsToday(data.chats);
        }
      } catch (err) {
        console.log("error: ", err);
      }

      try {
        const res = await fetch(`${apiUrl}/api/get-chats-last-7-days`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setchatsLast7Days(data.chats);
        }
      } catch (err) {
        console.log("error: ", err);
      }

      setIsChatsLoading(false);
    };

    getPrevChats();
  }, []);

  const handleChatSearchResultClick = async (chat) => {
    setActiveChat(chat);

    try {
      const res = await fetch(`${apiUrl}/api/get-replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          chat_id: chat,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReplies(data.replies);
        setIsSearch(false);
      }
    } catch (err) {
      console.log("error: ", err);
    }
  };

  return (
    <div className="search-container">
      <form onSubmit={handleChatSearch} className="search-bar-container">
        <textarea
          placeholder="Search chats..."
          className="search-bar"
          rows={1}
          style={{ resize: "none", lineHeight: "20px", overflowY: "auto" }}
        ></textarea>
        <button onClick={handleCloseChatSearch}>
          <img src="/close.svg" alt="close-icon" className="w-4" />
        </button>
      </form>
      {isChatsLoading ? (
        <div className="search-all-chats-container search-all-chats-container-skeleton">
          <div role="status" className="max-w-sm animate-pulse flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-[120px] mb-4"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-[360px] mb-4"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-[360px] mb-4"></div>
            </div>
            <span className="sr-only">Loading...</span>
          </div>
          <div role="status" className="max-w-sm animate-pulse flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-[120px] mb-4"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-[360px] mb-4"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-400 w-[360px] mb-4"></div>
            </div>
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="search-all-chats-container">
          {chatsToday.length != 0 ? (
            <div className="search-chats-container">
              <p className="chats-search-subtitle">Today</p>
              {chatsToday.map((chat, index) => (
                <button key={index} className="search-chat-container" onClick={() => handleChatSearchResultClick(chat.id)}>
                  <img src="/chat.svg" alt="chat-icon" className="w-4" />
                  <p className="default-text">{chat.chat_name}</p>
                </button>
              ))}
            </div>
          ) : (
            ""
          )}
          {chatsLast7Days.length != 0 ? (
            <div className="search-chats-container">
              <p className="chats-search-subtitle">Last 7 days</p>
              {chatsLast7Days.map((chat, index) => (
                <button key={index} className="search-chat-container" onClick={() => handleChatSearchResultClick(chat.id)}>
                  <img src="/chat.svg" alt="chat-icon" className="w-4" />
                  <p className="default-text">{chat.chat_name}</p>
                </button>
              ))}
            </div>
          ) : (
            ""
          )}
        </div>
      )}

      {searchedChats.length != 0 ? (
        <div className="searched-chats-background">
          {searchedChats.map((chat, index) => (
            <div key={index}>
              <img src="/chat.svg" alt="chat-icon" className="w-4" />
              <p className="default-text">{chat.chat_name}</p>
            </div>
          ))}
        </div>
      ) : (
        ""
      )}
    </div>
  );
};

export default SearchChats;
