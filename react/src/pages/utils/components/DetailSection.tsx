import React, { useState } from "react";
import {
    Button,
    Collapse,
    Grid,
    Typography,
    TextField,
    ButtonGroup,
    ButtonBase,
    Fade,
    Box,
    makeStyles,
    Tooltip,
    IconButton
} from "@material-ui/core";
import {
    Add,
    Edit,
    Check,
    Close
} from "@material-ui/icons";
import { FieldDisplayValueType, Field } from "../typings";

const gridSpacing = 2;
const titleWidth = 12;
const infoWidth = 6;

interface FieldDisplayProps {
    title: string;
    value?: FieldDisplayValueType;
}

/* Simple Typography component to display "title: value" */
function FieldDisplay({ title, value }: FieldDisplayProps) {
    let val = value;
    if (Array.isArray(value)) val = value.join(", ");
    else if (value === null || value === undefined) val = "";
    else if (typeof value === "boolean") val = value ? "Yes" : "No";

    return (
        <Typography variant="body1" gutterBottom >
            <b>{title}:</b> {val}
        </Typography>
    );
}

const formatValue = (value: FieldDisplayValueType) => {
    let val = value;
    if (Array.isArray(value)) val = value.join(", ");
    else if (value === null || value === undefined) val = "";
    else if (typeof value === "boolean") val = value ? "Yes" : "No";
    return val;
};

const useFieldsDisplayStyles = makeStyles(theme => ({
    textField: {
        margin: theme.spacing(0.2),
        // padding: theme.spacing(0),
    },
    button:{
        textTransform: "none",
        padding: theme.spacing(0.5),
        paddingleft: 0,
        // minHeight: 0,
        minWidth: 0,
    },
    box: {
        
    }
}));
const sexes = [
    {
        value: "Female",
        label: "Female",
    },
    {
        value: "Male",
        label: "Male",
    },
    {
        value: "Other",
        label: "Other",
    },
];
  
function LeftGridFieldsDisplay({ fields, editMode }: { fields: Field[]; editMode: boolean }) {
    const classes = useFieldsDisplayStyles();
    const [editing, setEditing] = useState<boolean[]>(fields.map(field => false));

  
    return (
        <>
            {fields.map((field, index) => {
                if (index >= Math.ceil(fields.length / 2)) {
                    return <></>;
                } else {
                    return (
                        <Box className={classes.box}>
                            {
                                editing[index] ? (
                                    <>
                                    <TextField
                                        className={classes.textField}
                                        id="standard-basic"
                                        label={field.title}
                                        defaultValue={formatValue(field.value)}
                                        margin="dense"
                                    />
                                    <IconButton onClick={() => {
                                        const newArray = [...editing]
                                        newArray[index] = false
                                        setEditing(newArray)
                                    }}>
                                        <Check />
                                    </IconButton>
                                    <IconButton onClick={() => {
                                        const newArray = [...editing]
                                        newArray[index] = false
                                        setEditing(newArray)
                                    }}>
                                        <Close />
                                    </IconButton>
                                    </>
                                ) : (
                                    <Tooltip title="Click to edit" placement="right">
                                        <Button onClick={()=> { 
                                            const newArray:boolean[] = [...editing]
                                        newArray[index] = true
                                        setEditing(newArray)}} className={classes.button}>
                                            <FieldDisplay title={field.title} value={field.value}  />
                                        </Button>
                                    </Tooltip>
                                )
                            }
                            
                        </Box>
                    );
                }
            })}
        </>
    );
}

function RightGridFieldsDisplay({ fields, editMode }: { fields: Field[]; editMode: boolean }) {
    const classes = useFieldsDisplayStyles();
    const [editing, setEditing] = useState<boolean[]>(fields.map(field => false));
    
    return (
        <>
            {fields.map((field, index) => {
                if (index < Math.ceil(fields.length / 2)) {
                    return <></>;
                } else {
                    return (
                        <Box className={classes.box}>
                            {
                                editing[index] ? (
                                    <>
                                    <TextField
                                        className={classes.textField}
                                        id="standard-basic"
                                        label={field.title}
                                        defaultValue={formatValue(field.value)}
                                        margin="dense"
                                    />
                                    <IconButton onClick={() => {
                                        const newArray = [...editing]
                                        newArray[index] = false
                                        setEditing(newArray)
                                    }}>
                                        <Check />
                                    </IconButton>
                                    <IconButton onClick={() => {
                                        const newArray = [...editing]
                                        newArray[index] = false
                                        setEditing(newArray)
                                    }}>
                                        <Close />
                                    </IconButton>
                                    </>
                                ) : (
                                    <Tooltip title="Click to edit" placement="right">
                                        <Button onClick={()=> { 
                                            const newArray:boolean[] = [...editing]
                                        newArray[index] = true
                                        setEditing(newArray)}} className={classes.button}>
                                            <FieldDisplay title={field.title} value={field.value}  />
                                        </Button>
                                    </Tooltip>
                                )
                            }
                            
                        </Box>
                    );
                }
            })}
        </>
    );
}
interface DetailSectionProps {
    fields: Field[];
    collapsibleFields?: Field[];
    title?: string;
}

export default function DetailSection({ fields, collapsibleFields, title }: DetailSectionProps) {
    const [moreDetails, setMoreDetails] = useState(false);
    const [editMode, setEditMode] = useState<boolean>(false);

    return (
        <>
            <Grid container spacing={gridSpacing} justify="space-evenly">
                {title && (
                    <Grid item xs={titleWidth}>
                        <Typography variant="h6">{title}</Typography>
                    </Grid>
                )}
                <Grid item xs={infoWidth}>
                    <LeftGridFieldsDisplay fields={fields} editMode={editMode} />
                </Grid>
                <Grid item xs={infoWidth}>
                    <RightGridFieldsDisplay fields={fields} editMode={editMode} />
                </Grid>
            </Grid>
            {collapsibleFields && (
                <>
                    <Collapse in={moreDetails}>
                        <Grid container spacing={gridSpacing} justify="space-evenly">
                            <Grid item xs={infoWidth}>
                                <LeftGridFieldsDisplay
                                    fields={collapsibleFields}
                                    editMode={editMode}
                                />
                            </Grid>
                            <Grid item xs={infoWidth}>
                                <RightGridFieldsDisplay
                                    fields={collapsibleFields}
                                    editMode={editMode}
                                />
                            </Grid>
                        </Grid>
                    </Collapse>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                            setMoreDetails(!moreDetails);
                        }}
                    >
                        {moreDetails ? "Hide" : "Show"} more details
                    </Button>
                </>
            )}
        </>
    );
}
