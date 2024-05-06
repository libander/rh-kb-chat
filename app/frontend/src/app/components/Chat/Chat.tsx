import userAvatar from '@app/assets/bgimages/avatar-user.svg';
import orb from '@app/assets/bgimages/orb.svg';
import config from '@app/config';
import { faCommentDots, faPaperPlane } from '@fortawesome/free-regular-svg-icons';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, CardBody, CardHeader, Flex, FlexItem, FormSelect, FormSelectOption, Grid, GridItem, Page, PageSection, Panel, PanelMain, PanelMainBody, Stack, StackItem, Text, TextArea, TextContent, TextVariants, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';


/**
 * Represents the Chat component.
 *
 * @component
 * @param {Object} props - The component props.
 * @returns {JSX.Element} The rendered Chat component.
 */
const Chat: React.FunctionComponent<{}> = () => {

  class Query {
    content: string;
    type = 'Query';

    /**
     * @description Establishes an object's initial properties upon creation, defining
     * the object's content to be the input `string`.
     * 
     * @param { string } content - content of the function, assigning it to a variable
     * named `this.content`.
     */
    constructor(content: string) {
      this.content = content;
    }
  }

  class Answer {
    content: string[];
    type = 'Answer';

    /**
     * @description Sets `this.content` to a provided `string[]`.
     * 
     * @param { string[] } content - array of strings that will be assigned to the object's
     * `content` field upon initialization.
     */
    constructor(content: string[]) {
      this.content = content;
    }
  }

  class Sources {
    content: string[];
    type = 'Sources';

    /**
     * @description Initializes a class instance by setting the `content` property to an
     * array of strings passed as an argument.
     * 
     * @param { string[] } content - array of strings that is assigned to the `content`
     * property of the constructor object.
     */
    constructor(content: string[]) {
      this.content = content;
    }
  }

  class Message {
    content: Query | Answer | Sources;

    /**
     * @description Assigns the `content` property to a provided value, which can be a
     * `Query`, `Answer`, or `Sources` object.
     * 
     * @param { Query | Answer | Sources } content - documentation for code that is
     * assigned to it within the constructor function.
     */
    constructor(content: Query | Answer | Sources) {
      this.content = content;
    }
  }

  class MessageHistory {
    content: Message[];

    /**
     * @description Sets the `content` field of a message class object to a provided array
     * of message objects.
     * 
     * @param { Message[] } content - message array passed to the constructor of a `Message`
     * class.
     */
    constructor(content: Message[]) {
      this.content = content;
    }
  }

  type Collection = {
    product: string;
    product_full_name: string;
    version: string[];
    language: string;
  };

  type MarkdownRendererProps = {
    children: string;
  };

  // Websocket
  const wsUrl = config.backend_api_url.replace(/http/, 'ws').replace(/\/api$/, '/ws'); // WebSocket URL
  const connection = React.useRef<WebSocket | null>(null); // WebSocket connection
  const uuid = Math.floor(Math.random() * 1000000000); // Generate a random number between 0 and 999999999

  // Collection elements
  const [collections, setCollections] = React.useState<Collection[]>([]); // The collections
  const [product, setProduct] = React.useState<string>('None'); // The selected product
  const [versions, setVersions] = React.useState<string[]>([]); // The versions for this product
  const [selectedVersion, setSelectedVersion] = React.useState<string>(''); // The selected version
  const [language, setLanguage] = React.useState<string>(''); // The selected language
  const [selectedCollection, setSelectedCollection] = React.useState<string>('none'); // Default collection name

  // Chat elements
  const [queryText, setQueryText] = React.useState<Query>(new Query('')); // The query text
  const [answerText, setAnswerText] = React.useState<Answer>(new Answer([''])); // The answer text
  const [answerSources, setAnswerSources] = React.useState<Sources>(new Sources([])); // Array of sources for the answer
  const [messageHistory, setMessageHistory] = React.useState<MessageHistory>(
    new MessageHistory([
      new Message(new Answer(['Hi! I am your documentation Assistant. How can I help you today?']))
    ])
  ); // The message history
  const chatBotAnswer = document.getElementById('chatBotAnswer'); // The chat bot answer element

  // Loads the collections from the backend on startup
  React.useEffect(() => {
    /**
     * @description Retrieves a list of collections from an API endpoint and sets the
     * collections array to the retrieved data.
     */
    const fetchCollections = async () => {
      const response = await fetch(`${config.backend_api_url}/collections`);
      const data = await response.json();
      setCollections(data);
    }
    fetchCollections();
  }, []);

  // Open a WebSocket connection and listen for messages
  React.useEffect(() => {
    const ws = new WebSocket(wsUrl + '/query/' + uuid) || {};

    ws.onopen = () => {
      console.log('opened ws connection')
    }
    ws.onclose = (e) => {
      console.log('close ws connection: ', e.code, e.reason)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data['type'] === 'token') {
        setAnswerText(answerText => new Answer([...answerText.content, data['token']]));
        return;
      } else if (data['type'] === 'source') {
        setAnswerSources(answerSources => new Sources([...answerSources.content, data['source']]));
        return;
      }
    }

    connection.current = ws;

    // Clean up function
    return () => {
      if (connection.current) {
        connection.current.close();
        console.log('WebSocket connection closed');
      }
    };
  }, [])

  // Scroll to the bottom of the chat window when the answer changes
  React.useEffect(() => {
    if (chatBotAnswer) {
      chatBotAnswer.scrollTop = chatBotAnswer.scrollHeight;
    }
  }, [answerText, answerSources]);  // Dependency array


  /**
   * Sends the query text to the server via WebSocket.
   * Saves the previous response, sources, query, and message history, and create a new Message History from them.
   * Clears the query text, previous response, and previous sources.
   * If the query text is empty, sets the previous response to ['Please enter a query...'].
   */
  const sendQueryText = () => {
    if (connection.current?.readyState === WebSocket.OPEN) {
      const previousAnswer = new Message(new Answer(answerText.content)); // Save the previous response, needed because states are updated asynchronously
      const previousSources = new Message(new Sources(answerSources.content)); // Save the previous sources
      const previousQuery = new Message(new Query(queryText.content)); // Save the previous query
      const previousMessageHistory = new MessageHistory(messageHistory.content); // Save the previous message history
      setMessageHistory(new MessageHistory([...previousMessageHistory.content, previousAnswer, previousSources, previousQuery])); // Add the previous response to the message history
      setQueryText(new Query('')); // Clear the query text
      setAnswerText(new Answer([])); // Clear the previous response
      setAnswerSources(new Sources([])); // Clear the previous sources
      // Put the query in a JSON object so that we can add other info later
      if (queryText.content !== "") {
        var product_full_name = "";
        if (selectedCollection !== 'none') {
          product_full_name = collections.find(collection => collection.product === product)?.product_full_name ?? "";
        } else {
          product_full_name = "None";
        }
        let data = {
          query: queryText.content,
          collection: selectedCollection,
          product_full_name: product_full_name,
          version: selectedVersion,
        };
        connection.current?.send(JSON.stringify(data)); // Send the query to the server
      } else {
        setAnswerText(new Answer(['Please enter a query...']));
      }
    };
  }

  /**
   * Resets the message history, answer sources, and answer text.
   * If a selected collection is provided, it sets the message history with a message about the selected collection and version.
   * If no collection is selected, it sets the message history with a default greeting message.
   */
  const resetMessageHistory = () => {
    setMessageHistory(new MessageHistory([]));
    setAnswerSources(new Sources([]));
    setAnswerText(new Answer(['']));
    const collection = collections.find(collection => collection.product === product);
    if (collection?.product_full_name !== "None") {
      setMessageHistory(new MessageHistory([
        new Message(
          new Answer(
            ['We are talking about **' + collection?.product_full_name + '** version **' + selectedVersion + '**. Ask me any question!']
          )
        )
      ]));
    } else {
      setMessageHistory(new MessageHistory([
        new Message(
          new Answer(['We are not talking about any specific product. Please choose one or tell me how can I help you!'])
        )
      ])
      );
    }
  };

  /**
   * Updates the collection based on the selected collection and version.
   * @param selectedCollection - The selected collection.
   * @param selectedVersion - The selected version.
   */
  const updateCollection = (selectedCollection: Collection, selectedVersion: string) => {
    setVersions(selectedCollection.version);
    setSelectedVersion(selectedVersion);
    setLanguage(selectedCollection.language);
    let collection_name = selectedCollection.product + '_' + selectedCollection.language + '_' + selectedVersion;
    setSelectedCollection(collection_name.replace(/[.-]/g, '_'));
    const previousAnswer = new Message( // Save the previous response, needed because states are updated asynchronously
      new Answer(answerText.content)
    );
    const previousSources = new Message( // Save the previous sources
      new Sources(answerSources.content)
    );
    const previousMessageHistory = new MessageHistory(messageHistory.content); // Save the previous message history
    if (selectedCollection.product_full_name !== "None") {
      setMessageHistory(new MessageHistory(
        [...previousMessageHistory.content,
          previousAnswer,
          previousSources,
        new Message(new Answer(
          ['Ok, we are now talking about **' + selectedCollection.product_full_name + '** version **' + selectedVersion + '**.']
        ))
        ]
      ));
    } else {
      setMessageHistory(new MessageHistory(
        [...previousMessageHistory.content,
          previousAnswer,
          previousSources,
        new Message(new Answer(
          ['Ok, we are not talking about any specific product.']
        ))
        ]
      ));
    }

    setAnswerText(new Answer([])); // Clear the previous response
    setAnswerSources(new Sources([])); // Clear the previous sources
  }

  /**
   * Handles the change event of the product select element.
   * @param _event - The form event object.
   * @param value - The selected value from the product select element.
   */
  const onChangeProduct = (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
    setProduct(value);
    const collection = collections.find(collection => collection.product === value);
    if (collection) {
      const version = collection.version[0];
      updateCollection(collection, version);
    }
  }

  /**
   * Handles the change event of the version select element.
   * 
   * @param _event - The form event object.
   * @param value - The selected value from the version select element.
   */
  const onChangeVersion = (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
    setSelectedVersion(value);
    const collection = collections.find(collection => collection.product === product);
    if (collection) {
      const version = value;
      updateCollection(collection, version);
    }
  }

  /**
   * Handles the change event of the language select element.
   * @param event - The change event.
   * @param value - The selected value.
   */
  const onChangeLanguage = (event: React.FormEvent<HTMLSelectElement>, value: string) => {
    setLanguage(value);
    let collection_name = product + '_' + language + '_' + selectedVersion;
    setSelectedCollection(collection_name.replace(/[.-]/g, '_'));
  }

  /**
   * Renders markdown content with syntax highlighting for code blocks.
   * 
   * @param markdown - The markdown content to render.
   * @returns The rendered markdown content.
   */
  const MarkdownRenderer = ({ children: markdown }: MarkdownRendererProps) => {
    /**
     * @description Generates high-quality documentation for code given to it.
     * 
     * @param { string } className - CSS class to be applied to the generated HTML element,
     * allowing for custom styling of the code output.
     * 
     * @param { array } remarkPlugins - 3rd-party plugins for the Remark module, allowing
     * you to customize the behavior of Markdown rendering within the component.
     * 
     * @param { array } rehypePlugins - 3rd party plugins that are used to convert Markdown
     * text into HTML using RehypeJS library.
     * 
     * @param { HTMLDivElement. } components - HTML components that are used to render
     * the Markdown text.
     * 
     * 		- `components`: an object containing various Markdown-related components, including
     * `code`.
     * 		- `code`: a component for rendering code snippets with syntax highlighting. The
     * `language` property is optional and defaults to `language-generic`. The `style`
     * property is required and specifies the CSS style for syntax highlighting. The
     * `PreTag` property is also optional and defaults to `div`. The `props` property is
     * an object that can contain various attributes for customizing the code rendering,
     * such as `className`.
     * 
     * 	Therefore, we can destructure the `components` object to access its properties
     * and use them to generate high-quality documentation for the given code.
     */
    return (
      <Markdown className='chat-question-text'
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');

            return !inline && match ? (
              <SyntaxHighlighter style={dracula} PreTag="div" language={match[1]} {...props}>
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className='chat-question-text' {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </Markdown>
    );
  }


  return (
    <Page>
      <PageSection>
        <Flex direction={{ default: 'column' }}>

          {/* Product, version and language selectors */}
          <FlexItem>
            <Flex>
              <FlexItem>
                <Flex direction={{ default: 'column' }}>
                  <FlexItem>
                    <TextContent>
                      <Text component={TextVariants.h3} >Product</Text>
                    </TextContent>
                  </FlexItem>
                  <FlexItem>
                    {/**
                     * @description Enables users to select a product from a list of collections, displaying
                     * each collection's corresponding products as options for selection.
                     * 
                     * @param { string } value - current selected product.
                     * 
                     * @param { function. } onChange - function to be called when the selection of product
                     * changes, allowing the application to update its state according to the selected product.
                     * 
                     * 		- `value`: The value of the select element, which can be assigned to a variable
                     * for further processing.
                     * 		- `onChange`: An event handler function that is called when the selection in the
                     * dropdown list changes. It receives the `newValue` argument, which represents the
                     * new selected value.
                     * 
                     * @param { string } aria-label - accessible label text for the FormSelect component,
                     * which assists users with disabilities in understanding the purpose of the form
                     * control and navigating through it.
                     * 
                     * @param { string } ouiaId - 12-digit Ontario Universally Unique Identifier (OUU)
                     * for the product, which is used to uniquely identify the product within the province
                     * of Ontario.
                     * 
                     * @param { string } className - class attribute for the Select element, specifying
                     * the CSS class to apply to the component.
                     */}
                    <FormSelect
                      value={product}
                      onChange={onChangeProduct}
                      aria-label="FormSelect Input"
                      ouiaId="BasicFormSelectCategory"
                      className="collection-select"
                    >
                      {collections && collections.map((collection, index) => (
                        <FormSelectOption key={index} value={collection.product} label={collection.product_full_name} />
                      ))}
                    </FormSelect>
                  </FlexItem>
                </Flex>
              </FlexItem>
              <FlexItem>
                <Flex direction={{ default: 'column' }}>
                  <FlexItem>
                    <TextContent>
                      <Text component={TextVariants.h3} >Version</Text>
                    </TextContent>
                  </FlexItem>
                  <FlexItem>
                    {/**
                     * @description Is used to render a form select component that allows the user to
                     * choose from multiple versions or languages. The selected version or language is
                     * stored in the `selectedVersion` variable and can be updated through the `onChangeVersion`
                     * handler.
                     * 
                     * @param { string } value - selected version in the `FormSelect` component, which
                     * is used to display the corresponding version label in the `onChange()` event.
                     * 
                     * @param { `event`. } onChange - event handler for when the selection changes and
                     * it will trigger whenever there is any change of value in the selected version
                     * 
                     * 		- `value`: The selected value of the form select input.
                     * 		- `onChange`: A callback function that is triggered when the user selects a new
                     * value from the dropdown menu. It takes two arguments: the value of the selected
                     * item and the event object.
                     * 
                     * @param { string } aria-label - accessibility label for the `FormSelect` component
                     * and is used to inform screen readers of the component's purpose, helping users
                     * navigate and interact with it more easily.
                     * 
                     * @param { string } ouiaId - ouia ID of the form select element, which is used to
                     * associate the accessibility properties with the select component.
                     * 
                     * @param { string } className - class name for the select component, allowing you
                     * to customize the CSS styles applied to it.
                     */}
                    <FormSelect
                      value={selectedVersion}
                      onChange={onChangeVersion}
                      aria-label="FormSelect Input"
                      ouiaId="BasicFormSelectCategory"
                      className='version-language-select'
                    >
                      {versions && versions.map((version, index) => (
                        <FormSelectOption key={index} value={version} label={version} />
                      ))}
                    </FormSelect>
                  </FlexItem>
                </Flex>
              </FlexItem>
              <FlexItem>
                <Flex direction={{ default: 'column' }}>
                  <FlexItem>
                    <TextContent>
                      <Text component={TextVariants.h3} >Language</Text>
                    </TextContent>
                  </FlexItem>
                  <FlexItem>
                    <FormSelect
                      value={language}
                      onChange={onChangeLanguage}
                      aria-label="FormSelect Input"
                      ouiaId="BasicFormSelectCategory"
                      className='version-language-select'
                    >
                      <FormSelectOption key={0} value={language} label={language} />
                    </FormSelect>
                  </FlexItem>
                </Flex>
              </FlexItem>
              {/* Uncomment the following code to display the collection name */}
              {/*                     <FlexItem>
                                <TextContent>
                                    <Text component={TextVariants.p} className=''>
                                        {collection}
                                    </Text>
                                </TextContent>
                            </FlexItem> */}
            </Flex>
          </FlexItem>

          {/* Chat Window */}
          <FlexItem className='flex-chat'>
            <Card isRounded className='chat-card'>
              <CardHeader className='chat-card-header'>
                <TextContent>
                  <Text component={TextVariants.h3} className='chat-card-header-title'><FontAwesomeIcon icon={faCommentDots} />&nbsp;Documentation Assistant</Text>
                </TextContent>
              </CardHeader>
              <CardBody className='chat-card-body'>
                <Stack>
                  <StackItem isFilled className='chat-bot-answer' id='chatBotAnswer'>
                    {/**
                     * @description Maps and renders message content, sources, or answers from a chat
                     * history based on their type.
                     */}
                    <TextContent>

                      {/* Message History rendering */}
                      {messageHistory.content.map((message: Message, index) => {
                        /**
                         * @description Handles different types of messages and generates high-quality
                         * documentation for each type based on the content provided in the message.
                         * 
                         * @returns { Component } a chat item with either an orb, a source link, or source
                         * text depending on the type of message.
                         */
                        const renderMessage = () => {
                          if (message.content.content.length != 0) {
                            if (message.content.type === "Query" && message.content.content != "") { // If the message is a query
                              return <Grid className='chat-item'>
                                <GridItem span={1} className='grid-item-orb'>
                                  <img src={userAvatar} className='user-avatar' />
                                </GridItem>
                                <GridItem span={11}>
                                  <Text component={TextVariants.p} className='chat-question-text'>{message.content.content}</Text>
                                </GridItem>
                              </Grid>
                            } else if (message.content.type === "Answer" && (message.content.content as string[]).join("") != "") { // If the message is a response
                              return <Grid className='chat-item'>
                                <GridItem span={1} className='grid-item-orb'>
                                  <img src={orb} className='orb' />
                                </GridItem>
                                <GridItem span={11}>
                                  <MarkdownRenderer>{(message.content.content as string[]).join("")}</MarkdownRenderer>
                                </GridItem>
                              </Grid>
                            } else if (message.content.type === "Sources") { // If the message is a source
                              return <Grid className='chat-item'>
                                <GridItem span={1} className='grid-item-orb'>&nbsp;</GridItem>
                                {/**
                                 * @description Takes a message with content as input and returns a list of text
                                 * components that display the message's content, including URLs, in a grid-like layout.
                                 * 
                                 * @param { string } span - 11th grid item in the `Chat` component.
                                 */}
                                <GridItem span={11}>
                                  <Text component={TextVariants.p} className='chat-source-text'>{"References: "}</Text>
                                  {message.content && (message.content.content as string[]).map((source, index) => {
                                    /**
                                     * @description Determines the visual representation of a chat source based on its
                                     * beginning, either an HTTP link or a plain text message.
                                     * 
                                     * @returns { string } a string of HTML markup containing either an `<a>` element or
                                     * plain text, depending on the value of the `source` parameter.
                                     */
                                    const renderSource = () => {
                                      if (source.startsWith('http')) {
                                        return <Text component={TextVariants.p} className='chat-source-text'>
                                          <a href={source} target="_blank" className='chat-source-link'>{source}</a>
                                        </Text>
                                      } else {
                                        return <Text component={TextVariants.p} className='chat-source-text'>{source}</Text>
                                      }
                                    };
                                    return (
                                      <React.Fragment key={index}>
                                        {renderSource()}
                                      </React.Fragment>
                                    );
                                  })}
                                </GridItem>
                              </Grid>
                            } else {
                              console.log('Unknown message type.');
                              return;
                            }
                          } else {
                            console.log('Empty message');
                            return;
                          }
                        }

                        return (
                          <React.Fragment key={index}>
                            {renderMessage()}
                          </React.Fragment>
                        );
                      })}

                      {/* New Answer rendering */}
                      {answerText.content.join("") !== "" && (
                        <Grid className='chat-item'>
                          <GridItem span={1} className='grid-item-orb'>
                            <img src={orb} className='orb' />
                          </GridItem>
                          {/**
                           * @description Generates high-quality documentation for given code using the
                           * MarkdownRenderer component and displays references to the source material.
                           * 
                           * @param { number } span - 11th grid item in the component.
                           */}
                          <GridItem span={11}>
                            <MarkdownRenderer>{answerText.content.join("")}</MarkdownRenderer>
                            <Text component={TextVariants.p} className='chat-source-text'>{answerSources.content.length != 0 && "References: "}</Text>
                            {answerSources && answerSources.content.map((source, index) => {
                              /**
                               * @description Determines the rendering of a chat message's source based on the
                               * provided string. If the source starts with 'http', it creates an anchor tag around
                               * the source, linking to the URL. Otherwise, it simply displays the source as text.
                               * 
                               * @returns { Component } a piece of text that links to the provided source or displays
                               * it as-is, depending on whether the source starts with 'http'.
                               */
                              const renderSource = () => {
                                if (source.startsWith('http')) {
                                  return <Text component={TextVariants.p} className='chat-source-text'>
                                    <a href={source} target="_blank" className='chat-source-link'>{source}</a>
                                  </Text>
                                } else {
                                  return <Text component={TextVariants.p} className='chat-source-text'>{source}</Text>
                                }
                              };
                              return (
                                <React.Fragment key={index}>
                                  {renderSource()}
                                </React.Fragment>
                              );
                            })}

                          </GridItem>
                        </Grid>
                      )}
                    </TextContent>
                  </StackItem>

                  {/* Input section */}
                  <StackItem className='chat-input-panel'>
                    <Panel variant="raised">
                      <PanelMain>
                        <PanelMainBody className='chat-input-panel-body'>
                          {/**
                           * @description Is designed to receive and handle user input for queries, allowing
                           * users to ask questions by typing into an input field, and triggering the execution
                           * of the `sendQueryText()` function when the Enter key is pressed.
                           * 
                           * @param { string } value - text content of the query box, and its purpose is to set
                           * the value of the `queryText` variable.
                           * 
                           * @param { string } type - type of text that will be interpreted as query input.
                           * 
                           * @param { `event.target.value`. } onChange - content of the query text field, and
                           * whenever it is updated by the user typing or pasting text into the field, its value
                           * is set to the updated content of the text area.
                           * 
                           * 	value: A property that represents the current value of the input. It takes a
                           * string type and is updated whenever the user types or pastes text into the input
                           * field.
                           * 
                           * 	type: An attribute that specifies the input's `type` property to be "text".
                           * 
                           * 	onChange: An event handler that runs when the input's value changes. It takes an
                           * `event` object as its argument and allows developers to modify the input's value
                           * or perform other actions in response to user input.
                           * 
                           * 	aria-label: An attribute that provides a human-readable label for the input
                           * element, helping screen readers communicate the input's purpose to users.
                           * 
                           * 	placeholder: An attribute that sets a placeholder text for the input field, helping
                           * users provide valid input without feeling lost or abandoned in a sea of blank space.
                           * 
                           * 	onKeyDown: An event handler that runs when the user presses a key while the input
                           * field has focus. It takes an `event` object as its argument and allows developers
                           * to perform actions based on keyboard inputs. In this case, it prevents the default
                           * behavior of submitting the query when the enter key is pressed, allowing developers
                           * to handle the query submission manually instead.
                           * 
                           * @param { string } aria-label - text label of an interface component for accessibility
                           * purposes.
                           * 
                           * @param { string } placeholder - placeholder text that is displayed in the text
                           * area when the user first opens it, and helps guide their input by suggesting what
                           * they can ask.
                           * 
                           * @param { object } onKeyDown - enter key on the user's keyboard, which triggers the
                           * `sendQueryText()` function when pressed.
                           */}
                          <TextArea
                            value={queryText.content}
                            type="text"
                            onChange={event => {
                              setQueryText({ ...queryText, content: event.target.value });
                            }}
                            aria-label="query text input"
                            placeholder='Ask me anything...'
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                sendQueryText();
                              }
                            }}
                          />
                          <Flex>
                            <FlexItem>
                              <Tooltip
                                content={<div>Start a new chat</div>}
                              >
                                <Button variant="link" onClick={resetMessageHistory} aria-label='StartNewChat'><FontAwesomeIcon icon={faPlusCircle} /></Button>
                              </Tooltip>
                            </FlexItem>
                            <FlexItem align={{ default: 'alignRight' }}>
                              <Tooltip
                                content={<div>Send your query</div>}
                              >
                                <Button variant="link" onClick={sendQueryText} aria-label='SendQuery'><FontAwesomeIcon icon={faPaperPlane} /></Button>
                              </Tooltip>
                            </FlexItem>

                          </Flex>
                        </PanelMainBody>
                      </PanelMain>
                    </Panel>
                  </StackItem>
                  <StackItem>
                    <TextContent>
                      <Text className='chat-disclaimer'>This assistant is powered by an AI. It may display inaccurate information, so please double-check the responses.<br/>Not an official chatbot for Red Hat documentation. For demonstration purposes only.</Text>
                    </TextContent>
                  </StackItem>
                </Stack>
              </CardBody>
            </Card >
          </FlexItem>
        </Flex>
      </PageSection>
    </Page>
  );
}

export { Chat };
