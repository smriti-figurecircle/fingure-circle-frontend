import { useEffect, useRef, useState } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users, Pin, PinOff } from 'lucide-react';
import axios from 'axios';
import baseURL from '@/config/config';
import { toast } from 'react-toastify';

interface MeetingCallProps {
  roomId: string;
  password: string;
  isHost: boolean;
  peer: Peer | null;
}

interface PeerData {
  stream: MediaStream;
  call: MediaConnection;
}

//@ts-ignore
const MeetingCall = ({ roomId, password, isHost, peer }: MeetingCallProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const peerConnectionsRef = useRef<Map<string, PeerData>>(new Map());
  const MAX_PARTICIPANTS = 8;
  const [screenSharingStream, setScreenSharingStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingPeerId, setScreenSharingPeerId] = useState<string | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const [isScreenSharePinned, setIsScreenSharePinned] = useState(false);
  const [schudle, setSchudle] = useState<any>();

  const [milestoneUrl, setMilestoneUrl] = useState("");
  const [feedbackUrl, setFeedbackUrl] = useState("");


  useEffect(() => {
    const url = new URL(window.location.href);
    // const pathSegments = url.pathname.split("/").filter(Boolean);
    const pathSegmentUrl = url.pathname + url.search; // Split & remove empty values
    // Split & remove empty values
    // console.log("pathSegments", pathSegmentUrl)
    // const lastSegment = pathSegments[pathSegments.length - 1]; // Get the last segment (e.g., "460")

    const fetchMilestoneData = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Token not found!');
        return;
      }
      try {
        const response = await axios.get(`${baseURL}/api/validMeeting`, {
          params: { link: pathSegmentUrl }
          // headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data) {
          setSchudle(response.data);
        } else {
          // if (lastSegment) {
          //   setMilestoneUrl(`/milestoneform/${lastSegment}`);
          // }
          console.log('No milestones found.');
        }
      } catch (error) {
        console.log('Failed to fetch milestone data.');
        console.error('Error fetching milestones:', error);
      } finally {
        // setLoading(false);
      }
    };





    fetchMilestoneData();


  }, []);

  useEffect(() => {

    const url = new URL(window.location.href);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    // Split & remove empty values
    // console.log("pathSegments", pathSegmentUrl)
    const lastSegment = pathSegments[pathSegments.length - 1]; // Get the last segment (e.g., "460")

    const fetchvalidationmiletone = async () => {
      const token = localStorage.getItem('token');

      console.log("schudle====>", schudle);

      if (!token) {
        toast.error('Token not found!');
        return;
      }
      try {
        const response = await axios.get(`${baseURL}/checkmeeting/milestone`, {
          params: { user_id: schudle?.user_id, mentor_id: schudle?.mentor_id },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data) {
          // setSchudle(response.data);
          console.log('milestones===>', response.data, response.data.user_id, response.data.mentor_id);
          setMilestoneUrl(`/milestoneformAdd/${response.data.user_id}-${response.data.mentor_id}`);
          setFeedbackUrl(`/feedbackform/${lastSegment}`);

        } else {

          console.log('No milestones found.');
        }
      } catch (error) {
        if (lastSegment) {
          setMilestoneUrl(`/milestoneform/${lastSegment}`);
          setFeedbackUrl(`/feedbackform/${lastSegment}`);
        }
        console.log('Failed to fetch milestone data.');
        console.error('Error fetching milestones:', error);
      } finally {
        // setLoading(false);
      }
    };

    fetchvalidationmiletone();
  }, [schudle]);


  // Initialize local media stream
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setLocalStream(stream);

        // If we're the host, initialize accepting calls
        if (isHost && peer) {
          peer.on('call', (call) => {
            call.answer(stream);
            handleIncomingCall(call);
          });
        }

        // If we're a participant, call the host
        if (!isHost && peer && stream) {
          console.log('Calling host:', roomId);
          const call = peer.call(roomId, stream);
          handleIncomingCall(call);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Unable to access camera or microphone. Please check your permissions.');
      }
    };

    initializeMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isHost, peer, roomId]);

  const handleIncomingCall = (call: MediaConnection) => {
    call.on('stream', (remoteStream: MediaStream) => {
      console.log('Received remote stream from:', call.peer);

      setPeers(prev => {
        const newPeers = new Map(prev);
        newPeers.set(call.peer, {
          stream: remoteStream,
          call: call
        });
        return newPeers;
      });

      setParticipants(prev => new Set([...prev, call.peer]));
    });

    call.on('close', () => {
      console.log('Call closed with peer:', call.peer);
      setPeers(prev => {
        const newPeers = new Map(prev);
        newPeers.delete(call.peer);
        return newPeers;
      });

      setParticipants(prev => {
        const newParticipants = new Set(prev);
        newParticipants.delete(call.peer);
        return newParticipants;
      });
    });

    call.on('error', (error) => {
      console.error('Call error:', error);
      call.close();
    });
  };

  // Update peer connections ref when peers change
  useEffect(() => {
    peerConnectionsRef.current = peers;
  }, [peers]);

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    // Clean up local media
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    peers.forEach(({ call }) => call.close());

    // Destroy peer connection
    if (peer) {
      peer.destroy();
    }

    // Navigate to home
    window.location.href = '/';
  };

  const startScreenSharing = async () => {
    try {
      // Request screen sharing stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          //@ts-ignore
          cursor: 'always'
        },
        audio: false
      });

      // Set local screen sharing state
      setScreenSharingStream(stream);
      setIsScreenSharing(true);
      setScreenSharingPeerId(peer?.id || null);

      // Set the stream to local screen video
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }

      // Share screen with all connected peers
      peers.forEach(({ call }) => {
        try {
          //@ts-ignore
          const screenTrack = stream.getVideoTracks()[0];
          // Create a new peer connection for screen sharing
          //@ts-ignore
          const screenSharingCall = peer?.call(call.peer, stream);

          // Send metadata about screen sharing
          if (peer) {
            const conn = peer.connect(call.peer);
            conn.on('open', () => {
              conn.send({
                type: 'screenShare',
                action: 'start',
                peerId: peer.id
              });
            });
          }
        } catch (error) {
          console.error('Error sharing screen with peer:', error);
        }
      });

      // Handle screen sharing stop
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

    } catch (error) {
      console.error('Error starting screen share:', error);
      setIsScreenSharing(false);
    }
  };

  const stopScreenSharing = () => {
    if (screenSharingStream) {
      // Stop all tracks in the screen sharing stream
      screenSharingStream.getTracks().forEach(track => track.stop());

      // Reset screen sharing state
      setScreenSharingStream(null);
      setIsScreenSharing(false);
      setScreenSharingPeerId(null);

      // Notify all peers that screen sharing has stopped
      peers.forEach(({ call }) => {
        if (peer) {
          const conn = peer.connect(call.peer);
          conn.on('open', () => {
            conn.send({
              type: 'screenShare',
              action: 'stop',
              peerId: peer.id
            });
          });
        }
      });
    }
  };

  // Handle incoming peer connections
  useEffect(() => {
    if (!peer) return;

    peer.on('connection', (conn) => {
      conn.on('data', (data: any) => {
        if (data.type === 'screenShare') {
          if (data.action === 'start') {
            setScreenSharingPeerId(data.peerId);
            console.log("ScreenShareOpennnnnnnnnn")
            setIsScreenSharePinned(true);
          } else if (data.action === 'stop') {
            setScreenSharingPeerId(null);
            setIsScreenSharePinned(false);
          }
        }
      });
    });

    peer.on('call', (call) => {
      if (localStream) {
        call.answer(localStream);

        call.on('stream', (remoteStream) => {
          // Check if this is a screen sharing stream
          if (call.metadata?.type === 'screenShare') {
            if (screenVideoRef.current) {
              screenVideoRef.current.srcObject = remoteStream;
            }
            setScreenSharingPeerId(call.peer);
          } else {
            // Handle regular video stream
            setPeers(prev => {
              const newPeers = new Map(prev);
              newPeers.set(call.peer, {
                stream: remoteStream,
                call
              });
              return newPeers;
            });
          }
        });
      }
    });
  }, [peer, localStream]);

  const renderParticipantVideos = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Screen sharing video */}
        {(isScreenSharing || screenSharingPeerId) && (
          <div className={`relative bg-black rounded-lg overflow-hidden ${isScreenSharePinned ? 'col-span-full row-span-2' : ''
            }`}>
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className={`w-full  ${isScreenSharePinned ? 'h-[82vh]':'h-[240px]'} object-contain`}
            />
            {/* <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setIsScreenSharePinned(!isScreenSharePinned)}
                className="p-2 bg-gray-800 rounded-full text-white hover:bg-gray-700"
              >
                {isScreenSharePinned ? <PinOff size={20} /> : <Pin size={20} />}
              </button>
            </div> */}
            <div className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              Screen Share {screenSharingPeerId === peer?.id ? '(You)' : ''}
            </div>
          </div>
        )}

        {/* Local video */}
        <div className="relative bg-black rounded-lg overflow-hidden ">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-[240px] object-cover"
          />
          <div className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
            You {isHost ? "(Host)" : ""}
          </div>
        </div>

        {/* Remote videos */}
        {Array.from(peers.entries()).map(([peerId, { stream }]) => (
          <div key={peerId} className="relative bg-black rounded-lg overflow-hidden">
            <video
              autoPlay
              playsInline
              className="w-full h-[240px] object-cover"
              ref={video => {
                if (video) video.srcObject = stream;
              }}
            />
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setIsScreenSharePinned(!isScreenSharePinned)}
                className="p-2 bg-gray-800 rounded-full text-white hover:bg-gray-700"
              >
                {isScreenSharePinned ? <PinOff size={20} /> : <Pin size={20} />}
              </button>
            </div>
            <div className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              Participant
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 relative">
      <div className="max-w-7xl mx-auto min-h-screen ">
        { (isScreenSharing || screenSharingPeerId) && isScreenSharePinned?(
          <>
            <div className="flex items-center text-gray-300 absolute top-5 z-10">
            <Users className="mr-2" size={20} />
            <span>{participants.size} / {MAX_PARTICIPANTS} participants</span>
          </div>
          <div className='flex flex-col gap-3 absolute top-20 right-8 z-10'>
          <div className="p-4 bg-gray-100 rounded-lg shadow-md">
          
          <p className="text-sm text-gray-600">Milestone URL:</p>
          <a
            href={milestoneUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 font-medium underline hover:text-blue-700"
          >
            Click here to open
          </a>
        </div>
        <div className="p-4 bg-gray-100 rounded-lg shadow-md">
          
          <p className="text-sm text-gray-600">Milestone URL:</p>
          <a
            href={milestoneUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 font-medium underline hover:text-blue-700"
          >
            Click here to open
          </a>
        </div>
            </div>
        </>
        ):(
        <div className="mb-4 flex items-center justify-between ">
          <div className="flex items-center text-gray-300">
            <Users className="mr-2" size={20} />
            <span>{participants.size} / {MAX_PARTICIPANTS} participants</span>
          </div>

          <div className='flex flex-col items-center gap-3'>
            <div className="p-4 bg-gray-100 rounded-lg shadow-md">
          
              <p className="text-sm text-gray-600">Milestone URL:</p>
              <a
                href={milestoneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 font-medium underline hover:text-blue-700"
              >
                Click here to open
              </a>
            </div>

            <div className="p-4 bg-gray-100 rounded-lg shadow-md">
          
              <p className="text-sm text-gray-600">Feedback</p>
              <a
                href={feedbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 font-medium underline hover:text-blue-700"
              >
                Click here to open
              </a>
            </div>
          </div>

          {/* {(isScreenSharing || screenSharingPeerId) && (
            <div className="text-gray-300">
              <span className="text-sm">
                {screenSharingPeerId === peer?.id ? "You are" : "Participant is"} sharing screen
              </span>
            </div>
          )} */}
        </div>
      )}
        {renderParticipantVideos()}

        {/* Controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 z-10">
          <div className="max-w-7xl mx-auto flex justify-center space-x-4">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full text-white hover:opacity-90 ${isAudioEnabled ? 'bg-gray-600' : 'bg-red-600'
                }`}
            >
              {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full text-white hover:opacity-90 ${isVideoEnabled ? 'bg-gray-600' : 'bg-red-600'
                }`}
            >
              {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <button
              onClick={isScreenSharing ? stopScreenSharing : startScreenSharing}
              className={`p-3 rounded-full text-white hover:opacity-90 ${isScreenSharing ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              disabled={!!screenSharingPeerId && screenSharingPeerId !== peer?.id}
            >
              <Monitor size={24} />
            </button>
            <button
              onClick={endCall}
              className="p-3 rounded-full text-white hover:opacity-90 bg-red-600"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingCall;