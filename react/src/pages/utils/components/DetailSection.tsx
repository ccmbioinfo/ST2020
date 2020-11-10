import React, { useState } from "react";
import { Button, Collapse, Grid, Typography, TypographyProps } from "@material-ui/core";
import { FieldDisplayValueType } from "../typings";

const gridSpacing = 2;
const titleWidth = 12;
const infoWidth = 6;

interface GridFieldDisplayProps {
    titles: string[];
    values: FieldDisplayValueType[];
}

function LeftGridFieldsDisplay({ titles, values }: GridFieldDisplayProps) {
    return (
        <>
            {titles.map((title, index) => {
                if (index >= Math.ceil(titles.length / 2)) {
                    return <></>;
                } else {
                    return <FieldDisplay title={title} value={values[index]} />;
                }
            })}
        </>
    );
}

function RightGridFieldsDisplay({ titles, values }: GridFieldDisplayProps) {
    return (
        <>
            {titles.map((title, index) => {
                if (index < Math.ceil(titles.length / 2)) {
                    return <></>;
                } else {
                    return <FieldDisplay title={title} value={values[index]} />;
                }
            })}
        </>
    );
}


/* Returns a simple Typography JSX element for displaying "title: value". */
function FieldDisplay(
    props: TypographyProps & { title: string; value?: FieldDisplayValueType }
) {
    let val = props.value;
    if (Array.isArray(props.value)) val = props.value.join(", ");
    else if (props.value === null || props.value === undefined) val = "";
    else if (typeof props.value === "boolean") val = props.value ? "Yes" : "No";

    return (
        <Typography variant={props.variant ? props.variant : "body1"} gutterBottom>
            <b>{props.title}:</b> {val}
        </Typography>
    );
}

interface DetailSectionProps {
    titles: string[];
    values: FieldDisplayValueType[];
    collapsibleTitles?: string[];
    collapsibleValues?: FieldDisplayValueType[];
    title?: string;
}

export default function DetailSection({
    titles,
    values,
    collapsibleTitles,
    collapsibleValues,
    title,
}: DetailSectionProps) {
    const [moreDetails, setMoreDetails] = useState(false);

    return (
        <>
            <Grid container spacing={gridSpacing} justify="space-evenly">
                {title && (
                    <Grid item xs={titleWidth}>
                        <Typography variant="h6">{title}</Typography>
                    </Grid>
                )}
                <Grid item xs={infoWidth}>
                    <LeftGridFieldsDisplay titles={titles} values={values} />
                </Grid>
                <Grid item xs={infoWidth}>
                    <RightGridFieldsDisplay titles={titles} values={values} />
                </Grid>
            </Grid>
            {collapsibleTitles && collapsibleValues && (
                <>
                    <Collapse in={moreDetails}>
                        <Grid container spacing={gridSpacing} justify="space-evenly">
                            <Grid item xs={infoWidth}>
                                <LeftGridFieldsDisplay
                                    titles={collapsibleTitles}
                                    values={collapsibleValues}
                                />
                            </Grid>
                            <Grid item xs={infoWidth}>
                                <RightGridFieldsDisplay
                                    titles={collapsibleTitles}
                                    values={collapsibleValues}
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
