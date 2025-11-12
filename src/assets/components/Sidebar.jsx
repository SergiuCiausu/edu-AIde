import { sidebarLinks } from "./sidebar-links";
import { useState, useEffect, useRef } from "react";

const Sidebar = ({ chats, setChats, setActiveChat, activeChat, setReplies, email, setIsSearch }) => {
  const apiUrl = import.meta.env.VITE_API_URL;

  const [rightClickedChat, setRightClickedChat] = useState("");
  const [deleteBtnCoords, setDeleteBtnCoords] = useState({});
  const buttonRef = useRef(null);

  const createChat = () => {
    console.log("Clicked create chat");
    setActiveChat(null);
    setReplies([]);
  };

  const searchChats = () => {
    setIsSearch(true);
  };

  const openNetworks = () => {
    console.log("Clicked open networks");
    setActiveChat(null);
    setReplies([]);
  };

  const handleChatClick = async (chat) => {
    setActiveChat(chat);

    try {
      const response = await fetch(`${apiUrl}/api/get-replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          chat_id: chat,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setReplies(data.replies);
      }
    } catch (err) {
      console.log("Error: ", err);
    }
  };

  const handleRightClick = async (e, chat) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();

    setDeleteBtnCoords({
      top: rect.top - rect.height - 15 + window.scrollY,
      left: rect.left + window.scrollX + 200,
    });

    setRightClickedChat(chat);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setRightClickedChat("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDeleteChat = async (chat) => {
    setActiveChat(null);

    try {
      const res = await fetch(`${apiUrl}/api/delete-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          chat_name: chat.chat_name,
          id: chat.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChats(data[1].chats);
      }
    } catch (err) {
      console.log("error: ", err.error);
    }
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-links-container">
        {sidebarLinks.map((link, index) => (
          <button key={index} className="sidebar-link-container" onClick={index === 0 ? createChat : index === 1 ? searchChats : openNetworks}>
            <img src={link.icon} alt={link.alt} className="w-4 2xl:w-6" />
            <p className="default-text">{link.label}</p>
          </button>
        ))}
      </div>
      <div className="chats-sidebar-container">
        <p className="subtitle-sidebar">Busted</p>
        {chats.map((chat, index) => (
          <button
            key={index}
            className={`default-text chat-name-box ${activeChat === chat.chat_name ? "active-chat-background" : ""}`}
            onClick={() => handleChatClick(chat.id)}
            onContextMenu={(e) => handleRightClick(e, chat.id)}
          >
            {chat.chat_name.replace(/^"|"$/g, "")}
            {rightClickedChat === chat.id && (
              <button
                ref={buttonRef}
                className="delete-chat-btn"
                onClick={() => handleDeleteChat(chat)}
                style={{
                  position: "absolute",
                  top: `${deleteBtnCoords.top}px`,
                  left: `${deleteBtnCoords.left}px`,
                  zIndex: 1000,
                }}
              >
                <p className="default-text">Delete chat</p>
              </button>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
